// aichat-plugin.js
class AIChatPlugin {
    constructor(config = {}) {
        // 配置项路径，支持外部传入
        this.configUrl = config.configUrl || '/waifu-chat.json'; 
        this.apiUrlOverride = config.apiUrl;
        this.blogIndex = [];
        this._welcomeInterval = null;
        
        // 页面加载完成后初始化
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    async init() {
        await this.loadConfig();
        this.initBlogIndex();
        this.initUI();
    }

    async loadConfig() {
        try {
            const timestamp = new Date().getTime();
            const res = await fetch(`${this.configUrl}?t=${timestamp}`);
            if (!res.ok) throw new Error('Config file not found');
            const extConfig = await res.json();
            this.applyConfig(extConfig);
        } catch (e) {
            console.warn("无法加载配置文件，将使用内置默认配置...", e);
            this.applyConfig({}); 
        }
    }

    applyConfig(cfg) {
        this.apiUrl = this.apiUrlOverride || cfg?.api?.url || '/api/chat';
        this.ui = Object.assign({
            title: "AI 助手",
            placeholder: "输入你想问的...",
            errorMsg: "网络连接中断，请稍后再试。",
            typingSpeed: 25,
            fabIcon: "",
            draggable: true
        }, cfg?.ui || {});
        
        this.chatCfg = Object.assign({
            storageKey: "aichat_plugin_history",
            maxHistory: 20,
            pageContextMaxLength: 3000,
            pageContextSelector: "#article-container",
            searchXmlPath: "/search.xml",
            welcomeMsg: "欢迎来到这里！请问有什么需要帮助你的？",
            welcomeOptions: [],
            contextTemplate: {
                pageContextTitle: "=== 用户当前阅读的页面 ===",
                searchContextTitle: "=== 全局检索结果 ===",
                instruction: "基于\"当前阅读页面\"或\"全局检索\"作答。补充上下文：",
                userQuestion: "用户实际提问:",
                truncateMsg: "[系统提示：页面内容过长已截断。]"
            }
        }, cfg?.chat || {});

        const rawPrompt = cfg?.chat?.systemPrompt;
        const defaultPrompt = "你是一个有用的 AI 助手。";
        if (Array.isArray(rawPrompt)) {
            this.systemPrompt = rawPrompt.join('\n');
        } else if (typeof rawPrompt === 'string') {
            this.systemPrompt = rawPrompt;
        } else {
            this.systemPrompt = defaultPrompt;
        }
        this.storageKey = this.chatCfg.storageKey;
        this.maxHistory = this.chatCfg.maxHistory;
    }

    initUI() {
        const svgTrash = '<svg viewBox="0 0 448 512"><path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"/></svg>';
        const svgClose = '<svg viewBox="0 0 384 512"><path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/></svg>';

        const container = document.createElement('div');
        container.id = 'AIChat-Plug-in-Container';
        container.className = 'AIChat-Plug-in';
        this.container = container; // 保存引用用于拖拽

        const fab = document.createElement('div');
        fab.className = 'AIChat-Plug-in-fab';
        if (this.ui.fabIcon) fab.style.backgroundImage = `url(${this.ui.fabIcon})`;

        const chatPanel = document.createElement('div');
        chatPanel.className = 'AIChat-Plug-in-panel';
        chatPanel.style.display = 'none'; 
        // 移除发送按钮，重构 DOM 结构
        chatPanel.innerHTML = `
            <div class="AIChat-Plug-in-header">
                <span class="AIChat-title">${this.ui.title}</span>
                <div class="AIChat-tools">
                    <span id="AIChat-clear" title="清空历史记录">${svgTrash}</span>
                    <span id="AIChat-close" title="收起窗口">${svgClose}</span>
                </div>
            </div>
            <div class="AIChat-Plug-in-messages" id="AIChat-Messages"></div>
            <div class="AIChat-Plug-in-input-area">
                <textarea id="AIChat-Input" rows="1" placeholder="${this.ui.placeholder}"></textarea>
            </div>
            <div class="AIChat-resize-handle AIChat-resize-t" data-pos="t"></div>
            <div class="AIChat-resize-handle AIChat-resize-r" data-pos="r"></div>
            <div class="AIChat-resize-handle AIChat-resize-b" data-pos="b"></div>
            <div class="AIChat-resize-handle AIChat-resize-l" data-pos="l"></div>
            <div class="AIChat-resize-handle AIChat-resize-tl" data-pos="tl"></div>
            <div class="AIChat-resize-handle AIChat-resize-tr" data-pos="tr"></div>
            <div class="AIChat-resize-handle AIChat-resize-bl" data-pos="bl"></div>
            <div class="AIChat-resize-handle AIChat-resize-br" data-pos="br"></div>
        `;

        container.appendChild(chatPanel);
        container.appendChild(fab);
        document.body.appendChild(container);

        this.chatPanel = chatPanel;
        this.fab = fab;
        this.chatHistoryDOM = document.getElementById("AIChat-Messages");
        this.chatInput = document.getElementById("AIChat-Input");

        // 绑定交互事件
        this.hasMoved = false; // 用于区分拖拽和点击
        fab.addEventListener('click', (e) => {
            if (this.hasMoved) {
                this.hasMoved = false; 
                return; // 如果刚才触发了拖拽，则取消此次点击事件
            }
            this.toggle();
        });

        this.chatHistoryDOM.addEventListener("click", (e) => {
            const target = e.target.closest('.AIChat-Plug-in-quick-action');
            if (target) {
                e.preventDefault();   // 阻止任何默认行为
                e.stopPropagation();  // 阻止冒泡
                
                let textToSend = target.getAttribute("data-send");
                if (!textToSend) return;
                
                // 解析 "||" 并随机抽取一条发送
                if (textToSend.includes("||")) {
                    const parts = textToSend.split("||").map(s => s.trim());
                    textToSend = parts[Math.floor(Math.random() * parts.length)];
                }
                
                this.sendRequest(textToSend);
            }
        });
        document.getElementById("AIChat-close").addEventListener("click", () => this.toggle());
        document.getElementById("AIChat-clear").addEventListener("click", () => {
            localStorage.removeItem(this.storageKey);
            if (this._welcomeInterval) { clearInterval(this._welcomeInterval); this._welcomeInterval = null; }
            this.renderHistory();
        });

        // 输入框逻辑 (彻底去除高度限制)
        this.chatInput.addEventListener("input", function() {
            this.style.height = "auto";
            this.style.height = this.scrollHeight + "px"; 
        });

        // 在发送事件中，发送后立刻重置高度
        this.chatInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault(); 
                const text = this.chatInput.value.trim();
                if (text !== "") {
                    this.chatInput.value = '';
                    this.chatInput.style.height = "auto";
                    this.sendRequest(text);
                }
            }
        });

        // 如果配置允许，初始化拖拽
        if (this.ui.draggable) {
            this.initDrag();
            this.initResize();
        }
        window.addEventListener('resize', () => this.enforceBounds());
        this.renderHistory();
    }

    initDrag() {
        let isDragging = false;
        let startX, startY, initialRight, initialBottom;
        const header = this.chatPanel.querySelector('.AIChat-Plug-in-header');

        const dragStart = (e) => {
            if (e.target.closest('.AIChat-tools')) return; // 防止拖拽与工具栏点击冲突
            if (e.type === 'touchstart') e = e.touches[0];
            startX = e.clientX; startY = e.clientY;

            const computedStyle = window.getComputedStyle(this.container);
            initialRight = parseFloat(computedStyle.right) || 0;
            initialBottom = parseFloat(computedStyle.bottom) || 0;

            isDragging = true; this.hasMoved = false;
            document.addEventListener('mousemove', dragMove, { passive: false });
            document.addEventListener('mouseup', dragEnd);
            document.addEventListener('touchmove', dragMove, { passive: false });
            document.addEventListener('touchend', dragEnd);
        };

        const dragMove = (e) => {
            if (!isDragging) return;
            let clientX = e.clientX, clientY = e.clientY;
            if (e.type === 'touchmove') {
                clientX = e.touches[0].clientX; clientY = e.touches[0].clientY;
                e.preventDefault(); 
            }
            const dx = clientX - startX, dy = clientY - startY;

            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                this.hasMoved = true;
                this.container.style.right = (initialRight - dx) + 'px';
                this.container.style.bottom = (initialBottom - dy) + 'px';
                this.enforceBounds(); // 实时动态边界干预
            }
        };

        const dragEnd = () => {
            isDragging = false;
            document.removeEventListener('mousemove', dragMove);
            document.removeEventListener('mouseup', dragEnd);
            document.removeEventListener('touchmove', dragMove);
            document.removeEventListener('touchend', dragEnd);
        };

        // 绑定悬浮球本体拖拽，与面板 Header 区域拖拽
        this.fab.addEventListener('mousedown', dragStart);
        this.fab.addEventListener('touchstart', dragStart, { passive: false });
        header.addEventListener('mousedown', dragStart);
        header.addEventListener('touchstart', dragStart, { passive: false });
    }

    initResize() {
        const handles = this.chatPanel.querySelectorAll('.AIChat-resize-handle');
        let isResizing = false;
        
        const startResize = (e) => {
            if (e.type === 'touchstart') e = e.touches[0];
            e.stopPropagation();
            isResizing = true;
            this.resizePos = e.target.getAttribute('data-pos');
            this.startX = e.clientX; 
            this.startY = e.clientY;
            
            // 记录初始宽高
            this.startW = this.chatPanel.offsetWidth;
            this.startH = this.chatPanel.offsetHeight;
            
            // 记录初始绝对坐标
            const computedStyle = window.getComputedStyle(this.container);
            this.startRight = parseFloat(this.container.style.right) || parseFloat(computedStyle.right) || 0;
            this.startBottom = parseFloat(this.container.style.bottom) || parseFloat(computedStyle.bottom) || 0;

            // 记录拖拽开始时，聊天面板四个边缘在屏幕上的真实物理像素坐标
            this.startRect = this.chatPanel.getBoundingClientRect();

            // 预判锚点方向
            this.isTopAnchored = this.chatPanel.classList.contains('AIChat-pos-top-left') || this.chatPanel.classList.contains('AIChat-pos-top-right');
            this.isLeftAnchored = this.chatPanel.classList.contains('AIChat-pos-top-left') || this.chatPanel.classList.contains('AIChat-pos-bottom-left');

            document.body.style.userSelect = 'none'; 
            document.addEventListener('mousemove', doResize, { passive: false });
            document.addEventListener('mouseup', stopResize);
            document.addEventListener('touchmove', doResize, { passive: false });
            document.addEventListener('touchend', stopResize);
        };

        const doResize = (e) => {
            if (!isResizing) return;
            let clientX = e.clientX, clientY = e.clientY;
            if (e.type === 'touchmove') { 
                clientX = e.touches[0].clientX; 
                clientY = e.touches[0].clientY; 
                e.preventDefault(); 
            }

            let dx = clientX - this.startX;
            let dy = clientY - this.startY;

            const ww = window.innerWidth;
            const wh = window.innerHeight;
            const safeTop = 70, safeX = 15, safeY = 15;
            const minW = 280, minH = 350;

            if (this.resizePos.includes('l')) {
                const min_dx = safeX - this.startRect.left; 
                if (dx < min_dx) dx = min_dx; // 触碰屏幕左边缘死角，截断向左位移
                const max_dx = this.startW - minW;
                if (dx > max_dx) dx = max_dx; // 触碰面板最小宽度，截断向右位移
            }
            if (this.resizePos.includes('r')) {
                const max_dx = (ww - safeX) - this.startRect.right;
                if (dx > max_dx) dx = max_dx; // 触碰屏幕右边缘死角，截断向右位移
                const min_dx = minW - this.startW;
                if (dx < min_dx) dx = min_dx; // 触碰面板最小宽度，截断向左位移
            }
            if (this.resizePos.includes('t')) {
                const min_dy = safeTop - this.startRect.top;
                if (dy < min_dy) dy = min_dy; // 触碰屏幕上边缘死角，截断向上位移
                const max_dy = this.startH - minH;
                if (dy > max_dy) dy = max_dy; // 触碰面板最小高度，截断向下位移
            }
            if (this.resizePos.includes('b')) {
                const max_dy = (wh - safeY) - this.startRect.bottom;
                if (dy > max_dy) dy = max_dy; // 触碰屏幕下边缘死角，截断向下位移
                const min_dy = minH - this.startH;
                if (dy < min_dy) dy = min_dy; // 触碰面板最小高度，截断向上位移
            }

            let newW = this.startW; 
            let newH = this.startH;
            let newRight = this.startRight; 
            let newBottom = this.startBottom;

            if (this.resizePos.includes('l')) { 
                newW = this.startW - dx; 
                if (this.isLeftAnchored) newRight = this.startRight - dx; 
            } 
            else if (this.resizePos.includes('r')) { 
                newW = this.startW + dx; 
                if (!this.isLeftAnchored) newRight = this.startRight - dx; 
            }

            if (this.resizePos.includes('t')) { 
                newH = this.startH - dy; 
                if (this.isTopAnchored) newBottom = this.startBottom - dy; 
            } 
            else if (this.resizePos.includes('b')) { 
                newH = this.startH + dy; 
                if (!this.isTopAnchored) newBottom = this.startBottom - dy; 
            }

            this.chatPanel.style.maxWidth = 'none'; 
            this.chatPanel.style.maxHeight = 'none';
            this.chatPanel.style.width = newW + 'px';
            this.chatPanel.style.height = newH + 'px';
            this.container.style.right = newRight + 'px';
            this.container.style.bottom = newBottom + 'px';
        };

        const stopResize = () => {
            isResizing = false;
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', doResize);
            document.removeEventListener('mouseup', stopResize);
            document.removeEventListener('touchmove', doResize);
            document.removeEventListener('touchend', stopResize);
        };

        handles.forEach(h => {
            h.addEventListener('mousedown', startResize);
            h.addEventListener('touchstart', startResize, { passive: false });
        });
    }

    enforceBounds() {
        if (!this.container) return;

        const computed = window.getComputedStyle(this.container);
        let right = parseFloat(this.container.style.right) || parseFloat(computed.right) || 0;
        let bottom = parseFloat(this.container.style.bottom) || parseFloat(computed.bottom) || 0;
        
        const ww = window.innerWidth;
        const wh = window.innerHeight;
        const safeTop = 70; // 规避 Hexo/Butterfly 顶部导航栏
        const safeX = 15;
        const safeY = 15;
        
        if (this.chatPanel.classList.contains('AIChat-panel-show')) {
            const maxW = ww - safeX * 2;
            const maxH = wh - safeTop - safeY;
            let currentW = this.chatPanel.offsetWidth;
            let currentH = this.chatPanel.offsetHeight;

            // 超出屏幕时先压缩自身宽高
            if (currentW > maxW) { this.chatPanel.style.width = maxW + 'px'; currentW = maxW; }
            if (currentH > maxH) { this.chatPanel.style.height = maxH + 'px'; currentH = maxH; }

            let distRight = right;
            let distBottom = bottom;
            let distLeft = ww - right - 56;
            let distTop = wh - bottom - 56;
            
            // 精确计算四个方向展开时的绝对屏幕距离
            if (this.chatPanel.classList.contains('AIChat-pos-bottom-right')) {
                distRight = right;
                distBottom = bottom + 70;
                distLeft = ww - distRight - currentW;
                distTop = wh - distBottom - currentH;
            } else if (this.chatPanel.classList.contains('AIChat-pos-bottom-left')) {
                distLeft = ww - right - 56;
                distBottom = bottom + 70;
                distRight = ww - distLeft - currentW;
                distTop = wh - distBottom - currentH;
            } else if (this.chatPanel.classList.contains('AIChat-pos-top-right')) {
                distRight = right;
                distTop = wh - bottom - 56 + 70;
                distBottom = wh - distTop - currentH;
                distLeft = ww - distRight - currentW;
            } else if (this.chatPanel.classList.contains('AIChat-pos-top-left')) {
                distLeft = ww - right - 56;
                distTop = wh - bottom - 56 + 70;
                distRight = ww - distLeft - currentW;
                distBottom = wh - distTop - currentH;
            }
            
            // 根据距离施加反向推力
            if (distTop < safeTop) bottom -= (safeTop - distTop); 
            if (distBottom < safeY) bottom += (safeY - distBottom); 
            if (distLeft < safeX) right -= (safeX - distLeft); 
            if (distRight < safeX) right += (safeX - distRight); 
        } 
        
        // 确保最终坐标
        if (right < safeX) right = safeX;
        if (right > ww - 56 - safeX) right = ww - 56 - safeX;
        if (bottom < safeY) bottom = safeY;
        if (bottom > wh - 56 - safeY) bottom = wh - 56 - safeY;
        
        this.container.style.right = right + 'px';
        this.container.style.bottom = bottom + 'px';
    }

    triggerSend() {
        const text = this.chatInput.value.trim();
        if (text !== "") {
            this.chatInput.value = '';
            this.chatInput.style.height = "auto"; 
            this.sendRequest(text);
        }
    }

    toggle() {
        const isHidden = !this.chatPanel.classList.contains('AIChat-panel-show');
        if (isHidden) {
            // 每次打开前，计算悬浮球在屏幕中的位置
            const rect = this.fab.getBoundingClientRect();
            // 以屏幕中心为十字轴，判断悬浮球处于哪个象限
            const isTop = rect.top < window.innerHeight / 2;
            const isLeft = rect.left < window.innerWidth / 2;

            this.chatPanel.className = 'AIChat-Plug-in-panel';
            
            // 始终向屏幕内部展开
            if (isTop && isLeft) this.chatPanel.classList.add('AIChat-pos-top-left');
            else if (isTop && !isLeft) this.chatPanel.classList.add('AIChat-pos-top-right');
            else if (!isTop && isLeft) this.chatPanel.classList.add('AIChat-pos-bottom-left');
            else this.chatPanel.classList.add('AIChat-pos-bottom-right');

            this.chatPanel.style.display = "flex";
            void this.chatPanel.offsetWidth;
            
            this.chatPanel.classList.add('AIChat-panel-show');
            this.fab.classList.add('AIChat-fab-active');
            setTimeout(() => this.enforceBounds(), 10);
            
            this.renderHistory(); 
            this.chatInput.focus();
            if (this.getHistory().length === 0) {
                this.showWelcomeMessage();
            }
        } else {
            // 收起面板
            this.chatPanel.classList.remove('AIChat-panel-show');
            this.fab.classList.remove('AIChat-fab-active');
            
            // 等待动画结束后再隐藏 DOM
            setTimeout(() => {
                if (!this.chatPanel.classList.contains('AIChat-panel-show')) {
                    this.chatPanel.style.display = "none";
                }
            }, 300);
        }
    }

    async initBlogIndex() {
        try {
            const res = await fetch(this.chatCfg.searchXmlPath);
            if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
            const xmlText = await res.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "application/xml");
            
            const entries = xmlDoc.querySelectorAll("entry");
            this.blogIndex = Array.from(entries).map(entry => {
                const titleNode = entry.querySelector("title");
                const contentNode = entry.querySelector("content");
                const urlNode = entry.querySelector("url");
                let pureText = "";
                if (contentNode) {
                    const tempDoc = parser.parseFromString(contentNode.textContent || "", "text/html");
                    tempDoc.querySelectorAll('script, style, noscript, link, iframe, svg').forEach(el => el.remove());
                    pureText = tempDoc.body.textContent.replace(/\s+/g, ' ').trim();
                }
                return {
                    title: titleNode ? titleNode.textContent.trim() : "",
                    url: urlNode ? urlNode.textContent.trim() : "",
                    content: pureText
                };
            });
        } catch (e) {
            console.warn(`RAG 降级：无法加载索引。`, e);
        }
    }

    searchLocalBlog(keyword) {
        if (!this.blogIndex.length) return "";
        let searchTerms = keyword;
        const titleMatch = keyword.match(/《(.*?)》/);
        if (titleMatch && titleMatch[1]) {
            searchTerms = titleMatch[1].trim();
        } else {
            searchTerms = keyword.replace(/(帮我|找下|寻找|搜索|博客|中|有关|关于|的|文章|内容|请问|什么是|怎么)/g, "").trim() || keyword;
        }

        const matched = this.blogIndex.filter(post => 
            (post.title && post.title.includes(searchTerms)) || 
            (post.content && post.content.includes(searchTerms))
        );
        
        if (matched.length === 0) return "";
        return matched.slice(0, 15).map(p => 
            `[标题: ${p.title}]\n[链接: ${p.url}]\n内容: ${p.content.replace(/<[^>]+>/g, '').substring(0, 300)}...`
        ).join("\n\n");
    }

    getCurrentPageContext() {
        const articleDOM = document.querySelector(this.chatCfg.pageContextSelector);
        if (!articleDOM) return "";
        const titleDOM = document.querySelector('h1.post-title') || document.querySelector('title');
        const title = titleDOM ? titleDOM.innerText.trim() : "当前页面";

        const cloneDOM = articleDOM.cloneNode(true);
        cloneDOM.querySelectorAll('script, style, noscript, iframe, svg, .post-outdate-notice, .clipboard-btn').forEach(el => el.remove());

        let pureText = cloneDOM.textContent.replace(/\s+/g, ' ').trim();
        if (pureText.length > this.chatCfg.pageContextMaxLength) {
            pureText = pureText.substring(0, this.chatCfg.pageContextMaxLength) + '\n\n' + this.chatCfg.contextTemplate.truncateMsg;
        }
        return `[当前页面标题: ${title}]\n[页面纯净正文]: ${pureText}`;
    }

    getHistory() {
        try { return JSON.parse(localStorage.getItem(this.storageKey)) || []; } 
        catch (e) { return []; }
    }

    saveHistory(history, syncStorage = true) {
        if (history.length > this.maxHistory * 2) {
            history = history.slice(-(this.maxHistory * 2));
        }
        if (syncStorage) {
            const storableHistory = history.filter(m => !m.isTemp).map(m => {
                let copy = { ...m };
                delete copy.isTyping; 
                return copy;
            });
            localStorage.setItem(this.storageKey, JSON.stringify(storableHistory));
        }
        this.renderHistory(history); 
    }

    renderHistory(currentHistory = null) {
        const history = currentHistory || this.getHistory();
        this.chatHistoryDOM.innerHTML = history
            .filter(msg => msg.role !== 'system') 
            .map(msg => {
                const isUser = msg.role === 'user';
                const msgClass = isUser ? 'AIChat-msg-user' : 'AIChat-msg-ai';
                const content = msg.displayContent || msg.content;
                let innerHTML = "";
                
                if (msg.isTemp) {
                    innerHTML = content;
                } else if (isUser) {
                    innerHTML = content.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
                } else {
                    if (typeof marked !== 'undefined') {
                        let rawHTML = marked.parse(content);
                        const doc = new DOMParser().parseFromString(rawHTML, 'text/html');
                        doc.querySelectorAll('a').forEach(a => {
                            a.setAttribute('target', '_blank');
                            a.setAttribute('rel', 'noopener noreferrer');
                        });
                        innerHTML = doc.body.innerHTML;
                    } else {
                        innerHTML = content.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
                    }
                }
                
                if (msg.options && msg.options.length > 0 && !msg.isTyping) {
                    let optionsHTML = `<div class="AIChat-options">`;
                    msg.options.forEach(opt => {
                        optionsHTML += `<div class="AIChat-option-item">
                            <a class="AIChat-Plug-in-quick-action" data-send="${opt.send}">
                                👉 ${opt.display}
                            </a>
                        </div>`;
                    });
                    optionsHTML += `</div>`;
                    innerHTML += optionsHTML;
                }

                return `<div class="AIChat-Plug-in-msg ${msgClass}"><div class="AIChat-Plug-in-bubble">${innerHTML}</div></div>`;
            }).join('');
            
        this.chatHistoryDOM.scrollTop = this.chatHistoryDOM.scrollHeight;
    }

    showWelcomeMessage() {
        let history = this.getHistory();
        if (history.length > 0) return; 
        
        const msgText = this.chatCfg.welcomeMsg;
        if (!msgText) return;

        history.push({ 
            role: "assistant", 
            content: "", 
            isTyping: true,
            options: this.chatCfg.welcomeOptions || [] 
        });
        this.saveHistory(history, false);

        let charIndex = 0;
        if (this._welcomeInterval) clearInterval(this._welcomeInterval);
        
        this._welcomeInterval = setInterval(() => {
            history[history.length - 1].content = msgText.substring(0, charIndex + 1);
            this.saveHistory(history, false);
            charIndex++;
            if (charIndex >= msgText.length) {
                clearInterval(this._welcomeInterval);
                this._welcomeInterval = null;
                history[history.length - 1].isTyping = false;
                this.saveHistory(history, true); 
            }
        }, this.ui.typingSpeed);
    }

    async sendRequest(userText) {
        if (this._welcomeInterval) {
            clearInterval(this._welcomeInterval);
            this._welcomeInterval = null;
            let h = this.getHistory();
            if (h.length === 0) {
                h.push({ role: "assistant", content: this.chatCfg.welcomeMsg, options: this.chatCfg.welcomeOptions || [] });
                this.saveHistory(h, true);
            }
        }

        let history = this.getHistory();
        history.push({ role: "user", content: userText, displayContent: userText });
        history.push({ 
            role: "assistant", 
            content: '<div class="AIChat-typing-dots"><span></span><span></span><span></span></div>',
            isTemp: true 
        });
        this.saveHistory(history, true); 

        const apiHistory = history.filter(m => !m.isTemp).map(m => ({ role: m.role, content: m.content }));
        const pageContext = this.getCurrentPageContext();
        const searchContext = this.searchLocalBlog(userText);
        let combinedContext = "";
        
        const ct = this.chatCfg.contextTemplate;
        if (pageContext) combinedContext += `${ct.pageContextTitle}\n${pageContext}\n\n`;
        if (searchContext) combinedContext += `${ct.searchContextTitle}\n${searchContext}\n\n`;
        
        if (combinedContext) {
            let lastMsg = apiHistory[apiHistory.length - 1];
            lastMsg.content = `${ct.instruction}\n${combinedContext}${ct.userQuestion} ${userText}`;
        }

        const messages = [{ role: "system", content: this.systemPrompt }, ...apiHistory];

        try {
            const res = await fetch(this.apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages })
            });

            if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
            const data = await res.json();
            
            history = history.filter(m => !m.isTemp);
            let fullAiReply = data.choices[0].message.content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

            history.push({ role: "assistant", content: "", isTyping: true }); 
            let charIndex = 0;
            const typeWriter = setInterval(() => {
                history[history.length - 1].content = fullAiReply.substring(0, charIndex + 1);
                this.saveHistory(history, false); 
                charIndex++;
                if (charIndex >= fullAiReply.length) {
                    clearInterval(typeWriter);
                    history[history.length - 1].isTyping = false; 
                    this.saveHistory(history, true); 
                }
            }, this.ui.typingSpeed);
        } catch (error) {
            console.error("AI Request Failed:", error);
            history = history.filter(m => !m.isTemp);
            history.push({ role: "assistant", content: this.ui.errorMsg, isTemp: false }); 
            this.saveHistory(history, true);
        }
    }
}

window.AIChatPlugin = AIChatPlugin;

(function autoBootstrapper() {
    let basePath = '/aichat/'; // 兜底默认路径
    const currentScript = document.currentScript;
    if (currentScript && currentScript.src) {
        basePath = currentScript.src.substring(0, currentScript.src.lastIndexOf('/') + 1);
    }

    if (!document.querySelector(`link[href="${basePath}aichat-plugin.css"]`)) {
        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = `${basePath}aichat-plugin.css`;
        document.head.appendChild(cssLink);
    }

    // 初始化挂件核心
    const initPlugin = () => {
        const start = () => new AIChatPlugin({ configUrl: `${basePath}aichat-plugin.json` });
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', start);
        } else {
            start();
        }
    };

    // 注入 Markdown 解析库
    if (typeof marked === 'undefined') {
        const markedScript = document.createElement('script');
        markedScript.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
        markedScript.onload = initPlugin; 
        markedScript.onerror = () => {
            console.warn("AIChat: marked.js 加载失败，将回退至无 Markdown 渲染模式。");
            initPlugin();
        };
        document.body.appendChild(markedScript);
    } else {
        initPlugin();
    }
})();