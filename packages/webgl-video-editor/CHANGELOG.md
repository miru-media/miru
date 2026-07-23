## [0.2.1](https://gitea.com/miru/miru/compare/webgl-video-editor@0.2.0...webgl-video-editor@0.2.1) (2026-07-23)
# [0.2.0](https://gitea.com/miru/miru/compare/webgl-video-editor@0.1.0...webgl-video-editor@0.2.0) (2026-07-21)


### Bug Fixes

* address profiling and testing; sync video to detection output ([61b545b](https://gitea.com/miru/miru/commits/61b545b3fc97881f7201277c173cfe31468a407f))
* address security scan issues ([4162e81](https://gitea.com/miru/miru/commits/4162e81af2bea0366ae259bf99840ccb7ad3023a))
* avoid shadow DOM in video editor UI ([44b0b8b](https://gitea.com/miru/miru/commits/44b0b8bf70674ff75da36332d5ef7f66f93dd239))
* **docs:** show error if loading video editor content fails ([3b4cafe](https://gitea.com/miru/miru/commits/3b4cafe16e04bb1ad2795be872221cf6e3d8fcc7))
* fix asset creation; clear canvas after emptying timeline ([b417710](https://gitea.com/miru/miru/commits/b417710b6a7172466a759ea9aa4c65221260d207))
* improve dev HMR; fix editor doc dispose when not owned ([4b90079](https://gitea.com/miru/miru/commits/4b90079ebfd894d5a247542c3a0b6966140019d4))
* improve video editor and trimmer accessibility ([e631c38](https://gitea.com/miru/miru/commits/e631c38d15292c009989f906ac2e1f5b9d39b277))
* resovle type errors ([e8d30b6](https://gitea.com/miru/miru/commits/e8d30b65e44ef34b76f70b628887f79cd6e29fa8))
* **webgl-video-editor:** add node.delete() ([c9832d8](https://gitea.com/miru/miru/commits/c9832d89ad12faa34d72cbcd23344a07e11734e1))
* **webgl-video-editor:** batch history in local-sync ([8b7e67a](https://gitea.com/miru/miru/commits/8b7e67a2378a8fa4cd698db35c4f76ed8bd3fb38))
* **webgl-video-editor:** delete nodes from ytree ([a35f812](https://gitea.com/miru/miru/commits/a35f812c2c5e157ef08ce4eab112e442987f2eb3))
* **webgl-video-editor:** fix filter menu ([1fc9e75](https://gitea.com/miru/miru/commits/1fc9e75d7bd18323e56dd931ab02cbfa76468e64))
* **webgl-video-editor:** fix keyboard nav in timeline and toolbar ([d06edbd](https://gitea.com/miru/miru/commits/d06edbd8c97637168c79371aa30fd40bfec13ba1))
* **webgl-video-editor:** fix rotated mp4s ([a436e57](https://gitea.com/miru/miru/commits/a436e5746c96b79ae88baf8b538efef9ee8c2ced))
* **webgl-video-editor:** handle missing asset data ([272b800](https://gitea.com/miru/miru/commits/272b800068c6c619ba2b9acab9f7ddf65ddd1d20))
* **webgl-video-editor:** misc ui and rendering improvements ([ab8c4f5](https://gitea.com/miru/miru/commits/ab8c4f5c4aee1806d079d9fbc00c9faf0340ac7b))
* **webgl-video-editor:** move views to parents on doc view init ([593dbc9](https://gitea.com/miru/miru/commits/593dbc97e2728dbe3f7f078f0ce99efcc41d5776))
* **webgl-video-editor:** remove movie replacement; use multi docs in demo ([64b3fee](https://gitea.com/miru/miru/commits/64b3fee50a1074e03f66b860563a46152b1cffe6))
* **webgl-video-eidtor:** remove redundant controls style ([e86e195](https://gitea.com/miru/miru/commits/e86e1958ed51f7a491fc52ccebed5e64e080cdfa))


### Features

* implement basic collaboration ([ed4a87d](https://gitea.com/miru/miru/commits/ed4a87d5c4bc219ea8b5c8981d1493f1485086e6))
* **nextgraph:** add basic NextGraph video editor integration ([4956283](https://gitea.com/miru/miru/commits/4956283844aee34de4c4b885b52757753604225a))
* update video editor header design ([11c8cb3](https://gitea.com/miru/miru/commits/11c8cb358e62f5fc72939619ed37527120fc1fa7))
* update website ([6d7a7b3](https://gitea.com/miru/miru/commits/6d7a7b383d2d8a468ced7fbd4378450a46e647f8))
* **webgl-video-editor:** add audio and video asset bin ([#36](https://gitea.com/miru/miru/issues/36)) ([43cffb1](https://gitea.com/miru/miru/commits/43cffb14cf704224547aead446c001adc96eb981))
* **webgl-video-editor:** add basic text support ([abdbf97](https://gitea.com/miru/miru/commits/abdbf976c7f8f0114b1a160ad86e98561cc65451))
* **webgl-video-editor:** add clip properties panel ([b643166](https://gitea.com/miru/miru/commits/b643166ac1a8c1b3359a4f0b049e849052172cfb))
* **webgl-video-editor:** add drag and resize controls ([1403245](https://gitea.com/miru/miru/commits/1403245f11ea52386ebfb03e71616123dcd467f8))
* **webgl-video-editor:** add filters asset bin ([#40](https://gitea.com/miru/miru/issues/40)) ([1c04628](https://gitea.com/miru/miru/commits/1c0462896d41edd8a810fe562c6c435abf877ec9))
* **webgl-video-editor:** add fonts asset bin ([#38](https://gitea.com/miru/miru/issues/38)) ([e091ebc](https://gitea.com/miru/miru/commits/e091ebcefec897f40b46787c9197dd54f636fcee))
* **webgl-video-editor:** add gap node ([fdf499d](https://gitea.com/miru/miru/commits/fdf499d28bf4193a8d8159d35078b16b630c35fb))
* **webgl-video-editor:** add OTIO export methods ([318523b](https://gitea.com/miru/miru/commits/318523bc2344fd7881383dc1b1d5294c858e346c))
* **webgl-video-editor:** add OTIO to doc json conversion ([ff8142b](https://gitea.com/miru/miru/commits/ff8142b4e1c6170b5f655e75d9299e269f31e483))
* **webgl-video-editor:** enable asset bin feature ([543113e](https://gitea.com/miru/miru/commits/543113e2dbcd9e8ffc9f66a010ed147fb10681f0))
* **webgl-video-editor:** implement EditDocument view with node proxies ([8cf7c5b](https://gitea.com/miru/miru/commits/8cf7c5bdbcdc4fe5482d93bc0d06a53610253656))
* **webgl-video-editor:** implement gapped editing and cross-track dragging ([12fbbed](https://gitea.com/miru/miru/commits/12fbbedf87fd4bf9f47c583666f5a0d23770a1ee))
* **webgl-video-editor:** implement timeline and playback controls for desktop ([8295fe8](https://gitea.com/miru/miru/commits/8295fe82d49d5b19eb314a777bc772c20fd7c291))
* **webgl-video-editor:** improve asset bin WCAG compliance ([#42](https://gitea.com/miru/miru/issues/42)) ([6a16bc3](https://gitea.com/miru/miru/commits/6a16bc33963223699b7c3d2f6625657c397e7341))
* **webgl-video-editor:** improve otio import ([c21942c](https://gitea.com/miru/miru/commits/c21942c785af4934ab7b9742e77ac0eac802a7f1))
* **webgl-video-editor:** improve yjs and asset handling ([6918928](https://gitea.com/miru/miru/commits/691892814d9d73ace0132d26f8678b7a4498c035))
* **webgl-video-editor:** store media with File System API ([5f65234](https://gitea.com/miru/miru/commits/5f652346299c12a74deb459b0b52fa05779e608d))
* **webgl-video-editor:** update design ([ff6159b](https://gitea.com/miru/miru/commits/ff6159b799d7b705fe2509a48af318562b297eb9))
* **webgl-video-editor:** update styles; move toolbar into lib ([4ffd0bf](https://gitea.com/miru/miru/commits/4ffd0bfa0d560c758415280ed7e3d869dd0fbb61))
* **webgl-video-editor:** use flat tramsform props ([afb0e46](https://gitea.com/miru/miru/commits/afb0e462a46fffcaa0245156ea0b1e90f3f7d9c9))
* **webgl-video-editor:** use rational time ([49fa3d9](https://gitea.com/miru/miru/commits/49fa3d9726584e8279822c5e264a46f6a17c470d))
* **webgl-video-editor:** while paused, render only if changed ([e5985fc](https://gitea.com/miru/miru/commits/e5985fcee2b9955f65a5d7140edb0a9dfe997319))
# 0.1.0 (2025-06-08)


### Features

* support webm files ([b50b6db](https://gitea.com/miru/miru/commits/b50b6db4c1e6a987b626636194e41afa28cbbf37))



