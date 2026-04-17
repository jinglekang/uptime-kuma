const NotificationProvider = require("./notification-provider");
const { DOWN, UP } = require("../../src/util");
const { default: axios } = require("axios");

const TOKEN_EXPIRE_BUFFER_MS = 60 * 1000;
const QINGTUI_TITLE_LIMIT = 45;
const QINGTUI_KEY_LIMIT = 8;
const QINGTUI_VALUE_LIMIT = 45;

class QingTui extends NotificationProvider {
    name = "QingTui";
    static tokenCache = new Map();
    static openIdCache = new Map();

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";
        try {
            const accessToken = await this.getAccessToken(notification);
            const userId = await this.getUserIdByPhone(accessToken, notification.userPhone);
            const openId = await this.getOpenIdByUserId(accessToken, userId);

            if (heartbeatJSON != null && monitorJSON != null && this.shouldSendKeyValueMessage(heartbeatJSON)) {
                const message = this.buildKeyValueMessage(msg, monitorJSON, heartbeatJSON);
                if (await this.sendKeyValueMessage(accessToken, openId, message)) {
                    return okMsg;
                }
            }

            if (await this.sendTextMessage(accessToken, openId, msg)) {
                return okMsg;
            }
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }

    /**
     * Get QingTui access token.
     * @param {BeanModel} notification Notification to send
     * @returns {Promise<string>} Access token
     */
    async getAccessToken(notification) {
        const cacheKey = `${notification.appId}:${notification.appSecret}`;
        const cachedToken = QingTui.tokenCache.get(cacheKey);

        if (cachedToken && cachedToken.expiresAt > Date.now()) {
            return cachedToken.accessToken;
        }

        let config = {
            method: "GET",
            url: `https://open.qingtui.com/v1/token?grant_type=client_credential&appid=${encodeURIComponent(notification.appId)}&secret=${encodeURIComponent(notification.appSecret)}`,
        };
        config = this.getAxiosConfigWithProxy(config);

        let result = await axios(config);
        if (result.data.access_token) {
            const expiresInMs = (result.data.expires_in || 7200) * 1000;
            QingTui.tokenCache.set(cacheKey, {
                accessToken: result.data.access_token,
                expiresAt: Date.now() + expiresInMs - TOKEN_EXPIRE_BUFFER_MS,
            });
            return result.data.access_token;
        }
        throw new Error(result.data.errmsg || result.data.errmsg_cn || "Failed to get QingTui access token");
    }

    /**
     * Get QingTui user ID by phone number.
     * @param {string} accessToken Access token
     * @param {string} userPhone Target phone number
     * @returns {Promise<string>} QingTui user ID
     */
    async getUserIdByPhone(accessToken, userPhone) {
        let config = {
            method: "GET",
            url: `https://open.qingtui.com/team/user/userid/list?access_token=${encodeURIComponent(accessToken)}&mobileList=${encodeURIComponent(userPhone)}`,
        };
        config = this.getAxiosConfigWithProxy(config);

        let result = await axios(config);
        let payload = result.data;
        if (payload.code === 0 && Array.isArray(payload.data?.list) && payload.data.list.length > 0) {
            return payload.data.list[0].userId;
        }

        throw new Error(payload.message || "Failed to convert QingTui phone number to user ID");
    }

    /**
     * Get QingTui openId by user ID.
     * @param {string} accessToken Access token
     * @param {string} userId QingTui user ID
     * @returns {Promise<string>} QingTui openId
     */
    async getOpenIdByUserId(accessToken, userId) {
        const cachedOpenId = QingTui.openIdCache.get(userId);

        if (cachedOpenId) {
            return cachedOpenId;
        }

        let config = {
            method: "GET",
            url: `https://open.qingtui.com/team/member/openid/get?access_token=${encodeURIComponent(accessToken)}&user_id=${encodeURIComponent(userId)}`,
        };
        config = this.getAxiosConfigWithProxy(config);

        let result = await axios(config);
        let payload = result.data;
        let openId = payload.open_id;

        if (openId) {
            QingTui.openIdCache.set(userId, openId);
            return openId;
        }

        throw new Error(payload.errmsg || "Failed to convert QingTui user ID to openId");
    }

    /**
     * Send a text message to a single QingTui user.
     * @param {string} accessToken Access token
     * @param {string} openId QingTui openId
     * @param {string} content Message content
     * @returns {Promise<boolean>} True if successful else false
     */
    async sendTextMessage(accessToken, openId, content) {
        let config = {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            url: `https://open.qingtui.com/v1/message/text/send/single?access_token=${encodeURIComponent(accessToken)}`,
            data: JSON.stringify({
                to_user: openId,
                message: {
                    content,
                },
            }),
        };
        config = this.getAxiosConfigWithProxy(config);

        let result = await axios(config);
        if (result.data.errcode === 0 || result.data.success === true) {
            return true;
        }
        throw new Error(result.data.errmsg || result.data.errmsg_cn || "Failed to send QingTui message");
    }

    /**
     * Send a key-value message to a single QingTui user.
     * @param {string} accessToken Access token
     * @param {string} openId QingTui openId
     * @param {object} message Message payload
     * @returns {Promise<boolean>} True if successful else false
     */
    async sendKeyValueMessage(accessToken, openId, message) {
        let config = {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            url: `https://open.qingtui.com/v1/message/keyValue/send/single?access_token=${encodeURIComponent(accessToken)}`,
            data: JSON.stringify({
                to_user: openId,
                message,
            }),
        };
        config = this.getAxiosConfigWithProxy(config);

        let result = await axios(config);
        if (result.data.errcode === 0 || result.data.success === true) {
            return true;
        }
        throw new Error(result.data.errmsg || result.data.errmsg_cn || "Failed to send QingTui key-value message");
    }

    /**
     * Build QingTui key-value message payload.
     * @param {string} msg Original message content
     * @param {object} monitorJSON Monitor details
     * @param {object} heartbeatJSON Heartbeat details
     * @returns {object} QingTui key-value payload
     */
    buildKeyValueMessage(msg, monitorJSON, heartbeatJSON) {
        const status = heartbeatJSON["status"];
        const statusIcon = this.statusToIcon(status);
        const statusText = this.statusToString(status);
        const statusChinese = this.statusToChinese(status);
        const monitorName = monitorJSON["name"] || "Uptime Kuma";
        const heartbeatMessage = heartbeatJSON["msg"] || msg || "N/A";
        const localDateTime = heartbeatJSON["localDateTime"] || "N/A";

        return {
            title: this.truncate(`${monitorName} ${statusChinese}`, QINGTUI_TITLE_LIMIT),
            sub_title: {
                text: this.truncate(`监控状态通知`, QINGTUI_VALUE_LIMIT),
                color: "GRAY",
            },
            content: [
                {
                    key: this.truncate("状态", QINGTUI_KEY_LIMIT),
                    value: this.truncate(`${statusIcon} ${statusText}`, QINGTUI_VALUE_LIMIT),
                    valueColor: "HIGHLIGHT",
                },
                {
                    key: this.truncate("时间", QINGTUI_KEY_LIMIT),
                    value: this.truncate(`${localDateTime}`, QINGTUI_VALUE_LIMIT),
                },
                {
                    key: this.truncate("详情", QINGTUI_KEY_LIMIT),
                    value: this.truncate(heartbeatMessage, QINGTUI_VALUE_LIMIT),
                    valueColor: "GRAY",
                },
            ]
        };
    }

    /**
     * Truncate string to QingTui API field length limit.
     * @param {string} value Input value
     * @param {number} limit Max string length
     * @returns {string} Truncated string
     */
    truncate(value, limit) {
        if (typeof value !== "string") {
            return "";
        }

        return value.length > limit ? `${value.slice(0, limit - 3)}...` : value;
    }

    /**
     * Check whether current heartbeat should use QingTui key-value message.
     * @param {object} heartbeatJSON Heartbeat details
     * @returns {boolean} True for UP/DOWN states
     */
    shouldSendKeyValueMessage(heartbeatJSON) {
        return heartbeatJSON["status"] === DOWN || heartbeatJSON["status"] === UP;
    }

    /**
     * Convert status constant to emoji icon.
     * @param {const} status The status constant
     * @returns {string} Emoji icon
     */
    statusToIcon(status) {
        switch (status) {
            case DOWN:
                return "🔴";
            case UP:
                return "✅";
            default:
                return "";
        }
    }

    /**
     * Convert status constant to Chinese label for title.
     * @param {const} status The status constant
     * @returns {string} Chinese status label
     */
    statusToChinese(status) {
        switch (status) {
            case DOWN:
                return "发生故障";
            case UP:
                return "已恢复";
            default:
                return this.statusToString(status);
        }
    }

    /**
     * Convert status constant to string
     * @param {const} status The status constant
     * @returns {string} Status
     */
    statusToString(status) {
        switch (status) {
            case DOWN:
                return "DOWN";
            case UP:
                return "UP";
            default:
                return status;
        }
    }
}

module.exports = QingTui;
