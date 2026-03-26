import '../../css/bulma-config.scss'

import { setupApp } from 'app-video-editor'
import { createApp } from 'vue'
import { createRouter, createWebHistory, RouterView } from 'vue-router'

const routes = [
  { path: '/', component: () => import('./project-list.vue') },
  { path: '/project', component: () => import('./project.vue') },
]

export const router = createRouter({
  history: createWebHistory('/video-editor'),
  routes,
})

const app = createApp(RouterView).use(setupApp).use(router)

app.mount('#app')
