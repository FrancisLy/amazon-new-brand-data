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

  Object.keys(comparisonResults).forEach(platform => {
    const result = comparisonResults[platform];
    const platformName = platformNames[platform] || platform;

    // 获取失败：明确展示
    if (result.error) {
      sections.push({
        title: `⚠️ ${platformName}`,
        fields: [{
          is_short: false,
          text: `**获取失败**\n${result.error}`
        }]
      });
      return;
    }

    // 无论有无变化，都显示该平台
    let fields = [];

    if (result.new.length > 0) {
      // 有评分数据时，按评分展示新增品牌
      if (result.scoredNew && result.scoredNew.length > 0) {
        const topScored = result.scoredNew.slice(0, 15);
        const gradeEmoji = { A: '🟢', B: '🟡', C: '🟠', D: '🔴' };
        const newLines = topScored.map(s => {
          const emoji = gradeEmoji[s.grade] || '⚪';
          const dim = s.scores;
          const src = s.sources;
          // 评分明细行
          let detail = `流量${dim.traffic} 佣金${dim.commission} 销量${dim.sales} 权重${dim.ranking}`;
          // 补充关键数据
          if (src.commissionRate > 0) detail += ` | 佣金${src.commissionRate.toFixed(1)}%`;
          if (src.productCount > 0) detail += ` | 产品${src.productCount}`;
          if (src.avgRating > 0) detail += ` | 评分${src.avgRating.toFixed(1)}★`;
          return `${emoji} [${s.total}分] ${s.brand.name}\n    ${detail}`;
        }).join('\n');
        fields.push({
          is_short: false,
          text: `**今日新增 (${result.new.length}个) - 按评分排序**\n${newLines}${result.new.length > 15 ? '\n...(仅展示前15个)' : ''}`
        });
      } else {
        fields.push({
          is_short: false,
          text: `**今日新增 (${result.new.length}个)**\n${result.new.slice(0, 20).map(b => `- ${b.name}（ID: ${b.id}）`).join('\n')}${result.new.length > 20 ? '\n...' : ''}`
        });
      }
    }

    if (result.removed.length > 0) {
      fields.push({
        is_short: false,
        text: `**今日下架 (${result.removed.length}个)**\n${result.removed.slice(0, 20).map(b => `- ${b.name}（ID: ${b.id}）`).join('\n')}${result.removed.length > 20 ? '\n...' : ''}`
      });
    }

    // 无新增无下架时，明确提示
    if (result.new.length === 0 && result.removed.length === 0) {
      fields.push({
        is_short: false,
        text: '✅ 今日无新增/下架'
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
  });

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
