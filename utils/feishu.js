const axios = require('axios');

async function getTenantAccessToken(appId, appSecret) {
  const response = await axios.post(
    'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
    { app_id: appId, app_secret: appSecret }
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

    if (result.error) {
      sections.push({
        title: `⚠️ ${platformName}`,
        fields: [{ is_short: false, text: `**获取失败**\n${result.error}` }]
      });
      return;
    }

    let fields = [];

    if (result.new.length > 0) {
      if (result.scoredNew && result.scoredNew.length > 0) {
        const gradeEmoji = { A: '🟢', B: '🟡', C: '🟠', D: '🔴' };
        const newLines = result.scoredNew.map(s => {
          const emoji = gradeEmoji[s.grade] || '⚪';
          const dim = s.scores;
          const src = s.sources;
          // 五维评分明细
          let detail = `流量${dim.traffic} 佣金${dim.commission} 销量${dim.sales} 权重${dim.ranking} 时效${dim.seasonality}`;
          // 补充关键数据
          if (src.commissionRate > 0) detail += ` | 佣金${src.commissionRate.toFixed(1)}%`;
          if (src.productCount > 0) detail += ` | 产品${src.productCount}`;
          if (src.avgRating > 0) detail += ` | 评分${src.avgRating.toFixed(1)}★`;
          // 时效匹配关键词
          if (src.matchedKeywords && src.matchedKeywords.length > 0) {
            detail += ` | 命中: ${src.matchedKeywords.join(', ')}`;
          }
          return `${emoji} [${s.total}分] ${s.brand.name}\n    ${detail}`;
        }).join('\n');
        // 顶部标注当前季节
        const seasonNote = result.scoredNew[0]?.sources?.seasonLabel ? `（本期: ${result.scoredNew[0].sources.seasonLabel}）` : '';
        fields.push({
          is_short: false,
          text: `**今日新增 (${result.new.length}个) - 按评分排序**${seasonNote}\n${newLines}`
        });
      } else {
        fields.push({
          is_short: false,
          text: `**今日新增 (${result.new.length}个)**\n${result.new.map(b => `- ${b.name}（ID: ${b.id}）`).join('\n')}`
        });
      }
    }

    if (result.removed.length > 0) {
      fields.push({
        is_short: false,
        text: `**今日下架 (${result.removed.length}个)**\n${result.removed.map(b => `- ${b.name}（ID: ${b.id}）`).join('\n')}`
      });
    }

    if (result.new.length === 0 && result.removed.length === 0) {
      fields.push({ is_short: false, text: '✅ 今日无新增/下架' });
    }

    fields.push({
      is_short: true,
      text: `**总数**: ${result.totalToday} (昨日: ${result.totalYesterday})`
    });

    sections.push({ title: `📊 ${platformName}`, fields: fields });
  });

  const card = {
    config: { wide_screen_mode: true, enable_forward: true },
    header: {
      title: { tag: 'plain_text', content: `📦 商家上新对比日报 - ${new Date().toLocaleDateString('zh-CN')}` }
    },
    elements: sections.map(section => ({
      tag: 'div',
      text: { tag: 'lark_md', content: `**${section.title}**\n\n${section.fields.map(f => f.text).join('\n\n')}` }
    }))
  };

  const token = await getTenantAccessToken(appId, appSecret);

  try {
    const response = await axios.post(
      'https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id',
      { receive_id: chatId, msg_type: 'interactive', content: JSON.stringify(card) },
      { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
    console.log('飞书通知发送成功:', response.data.msg);
    return response.data;
  } catch (error) {
    console.error('飞书通知发送失败:', error.message);
    throw error;
  }
}

module.exports = { sendFeishuNotification };
