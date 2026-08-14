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

async function sendCard(token, chatId, card) {
  const response = await axios.post(
    'https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id',
    { receive_id: chatId, msg_type: 'interactive', content: JSON.stringify(card) },
    { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
  return response.data;
}

// 飞书单条消息内容长度上限（保守值，避免内容过长被截断）
const MAX_CONTENT_LENGTH = 3500;

/**
 * 构建一个平台的文本块
 */
function buildPlatformSection(platformName, result) {
  if (result.error) {
    return {
      title: `⚠️ ${platformName}`,
      body: `**获取失败**\n${result.error}`
    };
  }

  let parts = [];

  if (result.new.length > 0) {
    const newLines = result.new.map(b => {
      let line = `- ${b.name}`;
      // 补充平台已有的基础信息
      if (b.avgCommission > 0) line += ` | 佣金${b.avgCommission}%`;
      else if (b.avg_commission > 0) line += ` | 佣金${b.avg_commission}%`;
      if (b.activeProductCount > 0) line += ` | 产品${b.activeProductCount}`;
      else if (b.active_products_count > 0) line += ` | 产品${b.active_products_count}`;
      return line;
    }).join('\n');
    parts.push(`**今日新增 (${result.new.length}个)**\n${newLines}`);
  }

  if (result.removed.length > 0) {
    const removedLines = result.removed.map(b => `- ${b.name}`).join('\n');
    parts.push(`**今日下架 (${result.removed.length}个)**\n${removedLines}`);
  }

  if (result.new.length === 0 && result.removed.length === 0) {
    parts.push('✅ 今日无新增/下架');
  }

  parts.push(`**总数**: ${result.totalToday} (昨日: ${result.totalYesterday})`);

  return {
    title: `📊 ${platformName}`,
    body: parts.join('\n\n')
  };
}

async function sendFeishuNotification(comparisonResults, config) {
  const { appId, appSecret, chatId } = config;

  const platformNames = {
    levanta: 'Levanta',
    partnerboost: 'PartnerBoost',
    wayward: 'Wayward',
    artemisads: 'ArtemisAds'
  };

  // 构建所有平台的文本块
  const sections = [];
  Object.keys(comparisonResults).forEach(platform => {
    const platformName = platformNames[platform] || platform;
    sections.push(buildPlatformSection(platformName, comparisonResults[platform]));
  });

  const token = await getTenantAccessToken(appId, appSecret);
  const dateStr = new Date().toLocaleDateString('zh-CN');

  // 将所有内容拼接，如果超过单条消息长度限制，拆分为多条发送
  let currentElements = [];
  let currentLength = 0;

  // 预估总消息数
  let totalLength = 0;
  for (const s of sections) {
    totalLength += s.title.length + s.body.length + 10;
  }
  const needsSplit = totalLength > MAX_CONTENT_LENGTH;

  function buildCard(elements, idx, total) {
    const header = needsSplit
      ? `📦 商家上新对比日报 - ${dateStr} (${idx}/${total})`
      : `📦 商家上新对比日报 - ${dateStr}`;
    return {
      config: { wide_screen_mode: true, enable_forward: true },
      header: { title: { tag: 'plain_text', content: header } },
      elements: elements
    };
  }

  // 收集所有消息批次
  const batches = [];
  for (const s of sections) {
    const sectionContent = `**${s.title}**\n\n${s.body}`;
    const sectionLen = sectionContent.length;

    // 如果当前块加入后超过限制，先保存当前批次
    if (currentLength + sectionLen > MAX_CONTENT_LENGTH && currentElements.length > 0) {
      batches.push(currentElements);
      currentElements = [];
      currentLength = 0;
    }

    currentElements.push({
      tag: 'div',
      text: { tag: 'lark_md', content: sectionContent }
    });
    currentLength += sectionLen;
  }
  // 最后一批
  if (currentElements.length > 0) {
    batches.push(currentElements);
  }

  console.log(`飞书消息拆分: 共 ${batches.length} 条消息`);

  for (let i = 0; i < batches.length; i++) {
    const card = buildCard(batches[i], i + 1, batches.length);
    try {
      await sendCard(token, chatId, card);
      console.log(`飞书通知发送成功 (${i + 1}/${batches.length})`);
      // 多条消息之间稍微间隔，避免频率限制
      if (i < batches.length - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (error) {
      console.error(`飞书通知发送失败 (${i + 1}/${batches.length}):`, error.message);
      throw error;
    }
  }
}

module.exports = { sendFeishuNotification };
