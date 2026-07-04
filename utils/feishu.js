const axios = require('axios');

// 获取 tenant_access_token
async function getTenantAccessToken(appId, appSecret) {
  const response = await axios.post(
    'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
    {
      app_id: appId,
      app_secret: appSecret
    }
  );
  if (response.data.code !== 0) {
    throw new Error(`获取飞书token失败: ${response.data.msg}`);
  }
  return response.data.tenant_access_token;
}

async function sendFeishuNotification(comparisonResults, config) {
  const { appId, appSecret, chatId } = config;

  const platformNames = {
    levanta: 'Levanta',
    partnerboost: 'PartnerBoost',
    wayward: 'Wayward',
    artemisads: 'ArtemisAds'
  };

  let sections = [];
  let hasChanges = false;

  Object.keys(comparisonResults).forEach(platform => {
    const result = comparisonResults[platform];
    const platformName = platformNames[platform] || platform;

    // 获取失败：明确展示，不再静默隐藏
    if (result.error) {
      hasChanges = true;
      sections.push({
        title: `⚠️ ${platformName}`,
        fields: [{
          is_short: false,
          text: `**获取失败**\n${result.error}`
        }]
      });
      return;
    }

    if (result.new.length > 0 || result.removed.length > 0) {
      hasChanges = true;

      let fields = [];

      if (result.new.length > 0) {
        fields.push({
          is_short: false,
          text: `**今日新增 (${result.new.length}个)**\n${result.new.slice(0, 20).map(b => `- ${b.name}（ID: ${b.id}）`).join('\n')}${result.new.length > 20 ? '\n...' : ''}`
        });
      }

      if (result.removed.length > 0) {
        fields.push({
          is_short: false,
          text: `**今日下架 (${result.removed.length}个)**\n${result.removed.slice(0, 20).map(b => `- ${b.name}（ID: ${b.id}）`).join('\n')}${result.removed.length > 20 ? '\n...' : ''}`
        });
      }

      fields.push({
        is_short: true,
        text: `**总数**: ${result.totalToday} (昨日: ${result.totalYesterday})`
      });

      sections.push({
        title: `📊 ${platformName}`,
        fields: fields
      });
    }
  });

  if (!hasChanges) {
    sections.push({
      title: '📊 今日概况',
      fields: [{
        is_short: false,
        text: '今日各平台商家清单无变化'
      }]
    });
  }

  const card = {
    config: {
      wide_screen_mode: true,
      enable_forward: true
    },
    header: {
      title: {
        tag: 'plain_text',
        content: `📦 商家上新对比日报 - ${new Date().toLocaleDateString('zh-CN')}`
      }
    },
    elements: sections.map(section => ({
      tag: 'div',
      text: {
        tag: 'lark_md',
        content: `**${section.title}**\n\n${section.fields.map(f => f.text).join('\n\n')}`
      }
    }))
  };

  const token = await getTenantAccessToken(appId, appSecret);

  try {
    const response = await axios.post(
      'https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id',
      {
        receive_id: chatId,
        msg_type: 'interactive',
        content: JSON.stringify(card)
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('飞书通知发送成功:', response.data.msg);
    return response.data;
  } catch (error) {
    console.error('飞书通知发送失败:', error.message);
    throw error;
  }
}

module.exports = { sendFeishuNotification };
