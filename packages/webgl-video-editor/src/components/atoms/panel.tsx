import styles from '../../css/index.module.css'

export const Panel = (props: { children?: unknown }) => <div class={styles.panel}>{props.children}</div>
