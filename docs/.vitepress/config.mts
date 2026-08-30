import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Threxus',
  description: '面向 Feature 与生命周期的 Three.js 轻量运行时',
  lang: 'zh-CN',
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: true,
  srcExclude: [
    'roadmap.md',
    'BROWSER_MATRIX.md',
    'Three.js*/**',
    'Three.js*.md',
  ],

  head: [['meta', { name: 'theme-color', content: '#0f172a' }]],

  themeConfig: {
    logo: undefined,
    siteTitle: 'Threxus',
    nav: [
      { text: '指南', link: '/guide/getting-started', activeMatch: '/guide/' },
      { text: 'API', link: '/api/create-three-app', activeMatch: '/api/' },
      { text: '示例', link: '/examples/cube', activeMatch: '/examples/' },
      { text: '参考', link: '/reference/browser-matrix', activeMatch: '/reference/' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: '开始',
          items: [
            { text: '简介', link: '/guide/introduction' },
            { text: '快速开始', link: '/guide/getting-started' },
            { text: '核心概念', link: '/guide/concepts' },
          ],
        },
        {
          text: '能力',
          items: [
            { text: 'Feature 与服务', link: '/guide/features' },
            { text: 'ThreeContext', link: '/guide/context' },
            { text: '资产系统', link: '/guide/assets' },
            { text: '输入与拾取', link: '/guide/input' },
            { text: '渲染与后处理', link: '/guide/rendering' },
            { text: '内置 Feature', link: '/guide/built-ins' },
            { text: '诊断与质量', link: '/guide/diagnostics' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'API 参考',
          items: [
            { text: 'createThreeApp', link: '/api/create-three-app' },
            { text: 'ThreeContext', link: '/api/three-context' },
            { text: '内置 Feature API', link: '/api/built-in-features' },
          ],
        },
      ],
      '/examples/': [
        {
          text: '示例',
          items: [
            { text: 'Vue3 /cube', link: '/examples/cube' },
            { text: '生命周期演示', link: '/examples/lifecycle' },
          ],
        },
      ],
      '/reference/': [
        {
          text: '参考',
          items: [
            { text: '浏览器矩阵', link: '/reference/browser-matrix' },
          ],
        },
      ],
    },
    socialLinks: [],
    outline: { level: [2, 3], label: '本页目录' },
    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索', buttonAriaLabel: '搜索文档' },
          modal: {
            noResultsText: '无结果',
            resetButtonTitle: '清除',
            footer: { selectText: '选择', navigateText: '切换' },
          },
        },
      },
    },
    footer: {
      message: 'Feature-oriented Three.js runtime',
      copyright: 'Copyright © Threxus',
    },
    docFooter: {
      prev: '上一篇',
      next: '下一篇',
    },
    lastUpdated: {
      text: '最后更新',
    },
  },
});
