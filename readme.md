# Hexo AI Chat Plug-in

&#8195;&#8195;本项目是 [live2d-widget-AIChat](https://github.com/LuoTian001/live2d-widget-AIChat) 的 AI 插件版本，功能包含完整 RAG（检索增强生成）检索和 Markdown 渲染，以及聊天 UI 交互逻辑。无 Live2D 渲染，适合仅接入 AI RAG 功能的用户。

> [!TIP]
>  此功能需要**后端服务器**支持，请确保已经按照 [后端配置教程](https://www.luotian.cyou/post/live2d-ai-chat.html) 部署了 **FastAPI + DeepSeek 后端服务**

<table style="width: 100%; text-align: center;">
  <tr><center>
    <td><img src="/example-img/1.png" width="100%" /><br><b>示例演示 1</b></td>
    <td><img src="/example-img/2.png" width="100%" /><br><b>示例演示 2</b></td>
  </center></tr>
  <tr><center>
    <td><img src="/example-img/3.png" width="100%" /><br><b>示例演示 3</b></td>
    <td><img src="/example-img/4.png" width="100%" /><br><b>示例演示 4</b></td>
  </center></tr>
</table>

## ⭐ 核心功能

* **1. AI 对话交互：**
  * **RAG 页面上下文感知：** 自动抓取当前阅读文章正文内容，AI 能够直接回答“这篇文章讲了什么”。
  * **RAG 全局知识库检索：** 结合 Hexo `search.xml`，实现博客全站内容的关联问答。
  * **Markdown 语法解析：** AI 回答支持加粗、代码块、列表等标准 Markdown 语法。
* **2. PJAX 适配：** 支持 Hexo + Butterfly 主题的 PJAX 无刷新加载。
* **3. 自定义配置：** 提供提示词（System Prompt）、欢迎语、快捷回复等配置选项，可通过 JSON 热更新。
* **4. 轻量级前端集成：** 通过 bottom 接入，无需修改主题源码。
* **5. 悬浮球交互：** 提供可拖拽的悬浮球入口，支持自定义图标和呼吸动画效果。支持移动端适配。

![](/example-img/0.png)

## 📂 文件说明

&#8195;&#8195;项目采用模块化设计，分离基础渲染层与 AI 逻辑层。主要目录结构与各文件功能说明如下：
```text
hexo-AIChat-Plugin/
├── aichat-plugin.js    # 核心逻辑驱动脚本
├── aichat-plugin.css   # 交互窗口样式表
└── aichat-plugin.json  # AI RAG 聊天配置文件
```
## 🚀 前端部署

> [!TIP] 
> 该部分教程假设你已经有一个基于 Hexo 的博客，并且正在使用 Butterfly 主题。如果为其他主题请根据实际情况调整资源路径和注入方式。

```bash
cd 你的博客目录/source/
git clone git@github.com:LuoTian001/hexo-AIChat-Plugin.git aichat
```
&#8195;&#8195;在`_config.yml`博客配置文件下添加以下代码，排除hexo对 `aichat` 目录的渲染：
```yaml
skip_render: 
  - 'aichat/**'
```
&#8195;&#8195;在 `_config.butterfly.yml` 文件中，找到 `inject.bottom` 节点，加入以下代码：
```js
inject:
  bottom:
    - <script src="/aichat/aichat-plugin.js" defer></script>
```
&#8195;&#8195;同时确保你已经安装 `hexo-generator-search` 插件，并在 `_config.butterfly.yml` 中正确配置了 `search.path`：
```bash
cd 你的博客目录/
npm install hexo-generator-search --save
```
```yaml
search:
  use: local_search
  path: search.xml
  field: post
  content: false
  format: striptags
  limit: 1000

local_search:
  enable: true
```
&#8195;&#8195;重新部署`hexo clean && hexo g && hexo d`，访问博客后你应该能够看到网页右下角出现了一个新的悬浮球图标，点击它就可以打开 AI 聊天窗口了。

## 🧩 参数配置 `aichat-plugin.json`

### 1. `api` (网络接口配置)

| 字段名 | 类型 | 默认值 | 作用说明 | 
| --- | --- | --- | --- | 
| `url` | String | `https://你的博客域名/api/chat` | 后端 AI 对话接口地址，这里请务必修改为你的接口地址 | 

### 2. `ui` (界面交互配置)

| 字段名 | 类型 | 默认值 | 作用说明 | 
| --- | --- | --- | --- | 
| `title` | String | `Relink` | 聊天面板顶部的显示标题。 | 
| `placeholder` | String | `发送消息...` | 底部输入框的占位提示文本 | 
| `errorMsg` | String | `大脑连接中断...` | 网络请求失败或后端报错时，AI 气泡弹出的提示语 | 
| `typingSpeed` | Number | `25` | 模拟打字机动画的速度（毫秒/字）。值越小，字弹出的速度越快 | 
| `fabIcon` | String |  `/aichat/favicon.ico` | 悬浮球自定义图标。填入图片 URL 可替换默认图标；留空则启用默认的渐变呼吸灯样式 | 
| `draggable` | Boolean | `true` | 悬浮球拖拽开关。开启后允许用户在页面内自由拖拽悬浮球 | 

### 3. `chat` (对话与 RAG 检索配置)

| 字段名 | 类型 | 默认值 | 作用说明 | 
| --- | --- | --- | --- | 
| `storageKey` | String | `aichat_plugin_history` | localStorage 的键名，用于在用户本地持久化保存对话历史记录 | 
| `maxHistory` | Number | `20` | 最大保留的上下文历史轮数，避免 payload 过大导致 token 溢出或请求被拒 | 
| `pageContextMaxLength` | Number | `3000` | **RAG 核心：** 抓取当前页面正文用于 RAG 注入时的最大字符长度。超出会自动截断 | 
| `pageContextSelector` | String | `#article-container` | **RAG 核心：** 抓取页面正文的 CSS 选择器。默认参数为 Hexo Butterfly 主题的样式 | 
| `searchXmlPath` | String | `/search.xml` | 博客全局检索索引文件的路径，用于 AI 跨页面检索全站内容 | 
| `welcomeMsg` | String | `欢迎来到...` | 首次打开聊天面板时，AI 自动发送的欢迎语 | 

#### 3.1 `welcomeOptions` (快捷选项按钮)

&#8195;&#8195;用于配置展示在欢迎语下方的快速回复选项。

- `display`: 按钮上向用户展示的文本。
- `send`: 用户点击该按钮后，实际发送给 AI 的隐藏指令。使用 || 分隔多个指令，系统会随机抽取其中一条发送。

#### 3.2 `systemPrompt` (系统提示词)

&#8195;&#8195;核心角色设定。支持字符串或字符串数组。为了 JSON 文件的可读性，建议使用数组格式，在解析时会自动用换行符 \n 将其拼接为完整长文本。

#### 3.3 `contextTemplate` (上下文模板)

&#8195;&#8195;控制 RAG 向大模型隐式注入的结构。该参数基本无需修改，除非需要完全自定义 RAG 注入的格式和提示词。

```JSON
"contextTemplate": {
  "pageContextTitle": "=== 用户当前阅读的页面 ===",
  "searchContextTitle": "=== 博客全局检索结果 ===",
  "instruction": "基于\"当前阅读页面\"或\"全局检索\"作答。补充上下文：",
  "userQuestion": "用户实际提问:",
  "truncateMsg": "[系统提示：页面内容过长已截断。请礼貌告知用户文章太长，未尽的信息需自行阅读原文。]"
}
```

- **RAG 容器匹配说明**

&#8195;&#8195;`waifu-chat.js` 中的本地阅读器默认通过 `#article-container` 选择器来提取当前页面的正文文本。如果你的 Hexo 博客未采用 Butterfly 主题，或者你在主题魔改中更改了文章主容器的 ID/Class，请务必在 `/config/waifu-chat.json` 中同步修改 `pageContextSelector` 字段。同时需检查你的站点根目录是否存在 `search.xml` 文件（由 `hexo-generator-search` 生成），并将其路径正确配置到 `searchXmlPath` 字段。

## 开源协议

&#8195;&#8195;本项目遵循 MIT 开源协议。
