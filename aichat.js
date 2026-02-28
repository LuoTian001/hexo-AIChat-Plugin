function initAIChatPlugin(config) {
    // 1. 创建顶层命名空间容器
    const container = document.createElement('div');
    container.id = 'AIChat-Plug-in-Container';
    container.className = 'AIChat-Plug-in';

    // 2. 创建 Siri 风格悬浮球
    const fab = document.createElement('div');
    fab.className = 'AIChat-Plug-in-fab';
    // 支持配置项自定义图标
    if (config.fabIcon) {
        fab.style.backgroundImage = `url(${config.fabIcon})`;
    }

    // 3. 创建聊天面板（复用你原有的聊天框内部结构）
    const chatPanel = document.createElement('div');
    chatPanel.className = 'AIChat-Plug-in-panel';
    chatPanel.style.display = 'none'; // 默认隐藏
    chatPanel.innerHTML = `
        <div class="AIChat-Plug-in-header">AI 助手</div>
        <div class="AIChat-Plug-in-messages" id="AIChat-Messages"></div>
        <div class="AIChat-Plug-in-input-area">
            <input type="text" id="AIChat-Input" placeholder="输入你想问的...">
            <button id="AIChat-SendBtn">发送</button>
        </div>
    `;

    // 4. 挂载 DOM
    container.appendChild(fab);
    container.appendChild(chatPanel);
    document.body.appendChild(container);

    // 5. 绑定唤起事件与交互动画
    fab.addEventListener('click', () => {
        const isHidden = chatPanel.style.display === 'none';
        chatPanel.style.display = isHidden ? 'flex' : 'none';
        // 触发过渡动画 class
        if (isHidden) {
            chatPanel.classList.add('AIChat-Plug-in-panel-show');
            fab.classList.add('AIChat-Plug-in-fab-active');
        } else {
            chatPanel.classList.remove('AIChat-Plug-in-panel-show');
            fab.classList.remove('AIChat-Plug-in-fab-active');
        }
    });

    // 6. 挂载原有的 API 请求、RAG 和 MD 解析逻辑
    bindChatLogic(config); 
}