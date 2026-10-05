use std::fs::File;
use std::io::{self, Read};
use std::net::SocketAddr;
use std::time::Duration;

use stun_types::attribute::XorMappedAddress;
use stun_types::message::{BINDING, Message, MessageWrite, MessageWriteVec};
use stun_types::prelude::MessageWriteExt;
use thiserror::Error;
use tokio::net::UdpSocket;
use warp::ws::{WebSocket, Ws};
use warp::{Filter, Rejection, Reply};
use yrs_warp::signaling::{SignalingService, signaling_conn};

const DEFAULT_HTTP_ADDRESS: ([u8; 4], u16) = ([127, 0, 0, 1], 8080);
const DEFAULT_STUN_ADDRESS: ([u8; 4], u16) = ([127, 0, 0, 1], 3478);

#[derive(Error, Debug)]
enum Error {
    #[error(transparent)]
    Io(#[from] io::Error),
    #[error("Include both --cert and --key args or neither.")]
    InvalidCertFlags,
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    let flags = xflags::parse_or_exit! {
        /// Stun bind address
        optional --stun address: SocketAddr
        /// Http/ws signaling bind address
        optional --http address: SocketAddr
        /// CORS allowed origins
        optional --cors origins: String

        /// Path to TLS certificate file
        optional --cert path: String
        /// Path to TLS key file
        optional --key path: String
    };

    let cert_key = match (flags.cert, flags.key) {
        (None, None) => None,
        (Some(cert), Some(key)) => Some((read_file(&cert)?, read_file(&key)?)),
        _ => return Err(Error::InvalidCertFlags),
    };

    let shutdown = tokio_graceful::Shutdown::default();

    tokio::spawn(async move {
        let addr = flags.stun.unwrap_or(DEFAULT_STUN_ADDRESS.into());
        let socket = UdpSocket::bind(addr).await?;
        println!("stun server listening on {}", addr);

        turn_handler(socket).await;
        Ok::<(), io::Error>(())
    });

    {
        let signaling_service = SignalingService::new();
        let signaling = warp::path("signaling")
            .and(warp::path::end())
            .and(warp::ws())
            .and(warp::any().map(move || signaling_service.clone()))
            .and_then(ws_handler);

        let cors = flags
            .cors
            .unwrap_or("".to_string())
            .trim_matches(',')
            .split(',')
            .fold(warp::cors(), |cors, origin| match origin {
                "" => cors,
                "*" => cors.allow_any_origin(),
                origin => cors.allow_origin(origin),
            })
            .build();
        let routes = signaling.with(cors);
        let addr = flags.http.unwrap_or(DEFAULT_HTTP_ADDRESS.into());
        let server = warp::serve(routes);
        let shutdown_guard = shutdown.guard_weak();

        if let Some((cert, key)) = cert_key {
            let (_, server) = server
                .tls()
                .cert(cert)
                .key(key)
                .bind_with_graceful_shutdown(addr, async move {
                    shutdown_guard.shutdown_signal_triggered().await;
                });
            tokio::task::spawn(server);
        } else {
            let (_, server) = server.bind_with_graceful_shutdown(addr, async move {
                shutdown_guard.shutdown_signal_triggered().await
            });
            tokio::task::spawn(server);
        };

        println!("http server listening on {addr}");
        println!(
            "Cors {}",
            std::env::var("MIRU_COLLAB_CORS_ORIGIN").unwrap_or("[none]".to_string())
        );
    };

    let _ = shutdown.shutdown_with_limit(Duration::from_secs(5)).await;

    Ok(())
}

async fn turn_handler(socket: UdpSocket) {
    let mut buf = [0; 1024];

    loop {
        let Ok((len, client_addr)) = socket.recv_from(&mut buf).await else {
            continue;
        };

        let data = &buf[..len];
        if let Ok(message) = Message::from_bytes(data)
            && message.method() != BINDING
        {
            let mut response = Message::builder_success(&message, MessageWriteVec::new());
            if let Err(error) = response.add_attribute(&XorMappedAddress::new(
                client_addr,
                response.transaction_id(),
            )) {
                eprintln!("{error}");
                return;
            }

            let response = response.finish();
            let _ = socket.try_send_to(&response, client_addr);
        }
    }
}

async fn ws_handler(ws: Ws, svc: SignalingService) -> Result<impl Reply, Rejection> {
    Ok(ws.max_message_size(2048).on_upgrade(move |socket| {
        println!("signalling connected");
        ws_peer(socket, svc)
    }))
}

async fn ws_peer(ws: WebSocket, svc: SignalingService) {
    match signaling_conn(ws, svc).await {
        Ok(_) => println!("signaling connection stopped"),
        Err(e) => eprintln!("signaling connection failed: {e}"),
    }
}

fn read_file(path: &str) -> io::Result<Vec<u8>> {
    let mut contents = Vec::new();
    File::open(path)?.read_to_end(&mut contents)?;
    Ok(contents)
}
