require('dotenv').config();

const schedule = require('node-schedule');
const { fetchLevantaBrands } = require('./fetchers/levanta');
const { fetchPartnerBoostBrands } = require('./fetchers/partnerboost');
const { fetchWaywardBrands } = require('./fetchers/wayward');
const { fetchArtemisAdsBrands } = require('./fetchers/artemisads');
const { saveBrands, loadBrands, getYesterdayDate, compareBrands, cleanupOldHistory } = require('./utils/storage');
const { sendFeishuNotification } = require('./utils/feishu');

const LEVANTA_API_KEY = process.env.LEVANTA_API_KEY;
const PARTNERBOOST_API_KEY = process.env.PARTNERBOOST_API_KEY;
const PARTNERBOOST_BIDS = process.env.PARTNERBOOST_BIDS;
const WAYWARD_API_KEY = process.env.WAYWARD_API_KEY;
const ARTEMISADS_API_KEY = process.env.ARTEMISADS_API_KEY;
const FEISHU_APP_ID = process.env.FEISHU_APP_ID;
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET;
const FEISHU_CHAT_ID = process.env.FEISHU_CHAT_ID;

async function runDailyTask() {
  console.log('========== 开始执行每日商家对比任务 ==========');
  const startTime = new Date();
  console.log(`开始时间: ${startTime.toLocaleString('zh-CN')}`);

  const yesterdayDate = getYesterdayDate();
  const comparisonResults = {};

  try {
    // 各平台并行获取，互不阻塞
    const platforms = [
      { key: 'levanta', fetch: () => fetchLevantaBrands(LEVANTA_API_KEY) },
      { key: 'partnerboost', fetch: () => fetchPartnerBoostBrands(PARTNERBOOST_API_KEY) },
      { key: 'wayward', fetch: () => fetchWaywardBrands(WAYWARD_API_KEY) },
      { key: 'artemisads', fetch: () => fetchArtemisAdsBrands(ARTEMISADS_API_KEY) }
    ];

    const settled = await Promise.allSettled(platforms.map(p => p.fetch()));

    for (let i = 0; i < platforms.length; i++) {
      const p = platforms[i];
      const result = settled[i];

      if (result.status === 'fulfilled') {
        const todayBrands = result.value;
        const yesterdayBrands = await loadBrands(p.key, yesterdayDate);
        comparisonResults[p.key] = compareBrands(todayBrands, yesterdayBrands);
        await saveBrands(p.key, todayBrands);
      } else {
        console.error(`${p.key} 获取失败，跳过: ${result.reason && result.reason.message}`);
        comparisonResults[p.key] = {
          new: [], removed: [],
          totalToday: 0, totalYesterday: 0,
          error: result.reason && result.reason.message || String(result.reason)
        };
      }
    }

    console.log('\n=== 比对结果 ===');
    console.log('Levanta:', JSON.stringify(comparisonResults.levanta));
    console.log('PartnerBoost:', JSON.stringify(comparisonResults.partnerboost));
    console.log('Wayward:', JSON.stringify(comparisonResults.wayward));
    console.log('ArtemisAds:', JSON.stringify(comparisonResults.artemisads));

    await sendFeishuNotification(comparisonResults, {
      appId: FEISHU_APP_ID,
      appSecret: FEISHU_APP_SECRET,
      chatId: FEISHU_CHAT_ID
    });

    // 清理超过 7 天的历史数据
    await cleanupOldHistory();

    const endTime = new Date();
    const duration = (endTime - startTime) / 1000;
    console.log(`\n结束时间: ${endTime.toLocaleString('zh-CN')}`);
    console.log(`耗时: ${duration.toFixed(2)}秒`);
    console.log('========== 每日商家对比任务执行完成 ==========');

  } catch (error) {
    console.error('每日商家对比任务执行失败:', error.message);
    throw error;
  }
}

function main() {
  console.log('商家上新对比服务已启动');
  console.log('定时任务: 每天北京时间 08:00 自动执行');
  console.log('服务将持续在后台运行，无需手动干预');

  const job = schedule.scheduleJob({ hour: 8, minute: 0, tz: 'Asia/Shanghai' }, () => {
    console.log(`\n[${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}] 定时触发`);
    runDailyTask().catch(console.error);
  });

  process.on('SIGINT', () => {
    console.log('\n服务正在关闭...');
    job.cancel();
    process.exit(0);
  });
}

module.exports = { runDailyTask };

// 直接运行时启动定时服务；被 require 时只暴露 runDailyTask
if (require.main === module) {
  main();
}
