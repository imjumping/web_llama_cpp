class AIChat {
    constructor() {
        this.isGenerating = false;
        this.isChatMode = false; // 默认续写模式
        this.conversationHistory = [];
        this.initializeEventListeners();
        this.checkConnection();
        this.updateModeDisplay();
    }

    initializeEventListeners() {
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');

        messageInput.addEventListener('input', () => {
            sendBtn.disabled = messageInput.value.trim() === '' || this.isGenerating;
        });

        // 回车键发送（Shift+Enter换行）
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
    }

    async checkConnection() {
        try {
            const statusElement = document.getElementById('status');
            statusElement.textContent = '状态: 检查AI服务器连接...';

            const response = await fetch(`${AI_SERVER_CONFIG.baseURL}/models`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                statusElement.textContent = '状态: 已连接到树莓派AI服务器 ✅';
                statusElement.style.color = 'green';
                this.addSystemMessage('系统启动成功！');
                this.addSystemMessage('当前模式: ' + (this.isChatMode ? '对话模式' : '续写模式'));
                this.addSystemMessage('点击右上角开关切换模式');
            } else {
                throw new Error('服务器响应异常');
            }
        } catch (error) {
            this.handleConnectionError(error);
        }
    }

    // 模式切换功能
    toggleMode() {
        this.isChatMode = !this.isChatMode;
        this.updateModeDisplay();

        if (this.isChatMode) {
            this.addSystemMessage('已切换到对话模式 💬');
            this.addSystemMessage('我会记住对话上下文进行交流');
        } else {
            this.addSystemMessage('已切换到续写模式 📝');
            this.addSystemMessage('我会直接续写你输入的内容');
            // 清空历史，避免续写时受到对话历史影响
            this.conversationHistory = [];
        }
    }

    updateModeDisplay() {
        const modeLabel = document.getElementById('modeLabel');
        const modeToggle = document.getElementById('modeToggle');

        modeLabel.textContent = this.isChatMode ? '对话模式' : '续写模式';
        modeToggle.checked = this.isChatMode;

        // 更新状态提示
        const statusElement = document.getElementById('status');
        statusElement.textContent = `状态: 已连接 (${this.isChatMode ? '对话' : '续写'}模式) ✅`;
    }

    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();

        if (!message || this.isGenerating) return;

        // 添加用户消息
        this.addMessage('user', message);
        messageInput.value = '';
        document.getElementById('sendBtn').disabled = true;
        this.isGenerating = true;

        // 创建AI消息占位符
        const aiMessageDiv = this.createMessageElement('ai', this.isChatMode ? '思考中...' : '生成中...');
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.appendChild(aiMessageDiv);

        try {
            const maxTokens = parseInt(document.getElementById('maxTokens').value) || 150;
            const temperature = parseFloat(document.getElementById('temperature').value) || 0.7;

            let requestBody;

            if (this.isChatMode) {
                // 对话模式 - 使用对话历史
                this.conversationHistory.push({ role: "user", content: message });

                requestBody = {
                    prompt: this.buildChatPrompt(),
                    max_tokens: maxTokens,
                    temperature: Math.min(temperature, 0.8), // 对话模式温度低一些
                    stop: ["用户:", "AI:", "\n\n", "。", "！", "？"]
                };
            } else {
                // 续写模式 - 直接续写
                requestBody = {
                    prompt: message,
                    max_tokens: maxTokens,
                    temperature: temperature, // 续写模式温度可以高一些
                    stop: ["\n\n", "。", "！", "？"]
                };
            }

            const response = await fetch(`${AI_SERVER_CONFIG.baseURL}/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error(`HTTP错误: ${response.status}`);
            }

            const data = await response.json();
            let aiResponse = data.choices[0].text.trim();

            // 清理响应
            if (this.isChatMode) {
                // 移除可能重复的AI前缀
                aiResponse = aiResponse.replace(/^(AI|助手|机器人):\s*/i, '').trim();
            }

            // 更新AI消息内容
            aiMessageDiv.textContent = aiResponse;

            // 如果是对话模式，保存到历史
            if (this.isChatMode) {
                this.conversationHistory.push({ role: "assistant", content: aiResponse });

                // 限制历史记录长度，避免提示词过长
                if (this.conversationHistory.length > 8) {
                    this.conversationHistory = this.conversationHistory.slice(-6);
                }
            }

        } catch (error) {
            console.error('API调用错误:', error);
            aiMessageDiv.textContent = `抱歉，出错了: ${error.message}`;
            aiMessageDiv.className = 'message system';
        } finally {
            this.isGenerating = false;
            document.getElementById('sendBtn').disabled = false;
            messageInput.focus();
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    buildChatPrompt() {
        if (this.conversationHistory.length <= 1) {
            return `你是一个有帮助的AI助手，请用中文与用户进行自然友好的对话。

            用户: ${this.conversationHistory[0].content}

            AI:`;
        }

        let prompt = "请继续以下对话：\n\n";

        // 使用最近的历史记录（避免太长）
        const recentHistory = this.conversationHistory.slice(0, -1);

        recentHistory.forEach(msg => {
            const prefix = msg.role === "user" ? "用户: " : "AI: ";
            prompt += `${prefix}${msg.content}\n\n`;
        });

        // 添加当前用户消息
        const lastUserMessage = this.conversationHistory[this.conversationHistory.length - 1].content;
        prompt += `用户: ${lastUserMessage}\n\nAI: `;

        return prompt;
    }

    addMessage(role, content) {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        messageDiv.textContent = content;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    addSystemMessage(content) {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system';
        messageDiv.textContent = content;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    createMessageElement(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        messageDiv.textContent = content;
        return messageDiv;
    }

    handleConnectionError(error) {
        console.error('连接错误:', error);
        const statusElement = document.getElementById('status');
        statusElement.textContent = '状态: 连接失败 ❌';
        statusElement.style.color = 'red';

        this.addSystemMessage('无法连接到树莓派AI服务器。请检查：');
        this.addSystemMessage('1. 树莓派是否运行 llama-server');
        this.addSystemMessage('2. 网络连接是否正常');
        this.addSystemMessage('3. 服务器地址: ' + AI_SERVER_CONFIG.baseURL);
    }
}

// 全局函数供HTML调用
function sendMessage() {
    if (window.aiChat) {
        window.aiChat.sendMessage();
    }
}

function toggleMode() {
    if (window.aiChat) {
        window.aiChat.toggleMode();
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.aiChat = new AIChat();

    // 添加键盘快捷键：Ctrl+Enter 发送，Ctrl+M 切换模式
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendMessage();
            } else if (e.key === 'm' || e.key === 'M') {
                e.preventDefault();
                toggleMode();
            }
        }
    });
});

// 导出用于测试（如果需要）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIChat;
}
