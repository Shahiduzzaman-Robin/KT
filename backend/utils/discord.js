const axios = require('axios');

/**
 * Format BDT currency
 */
function formatBDT(amount) {
  return `৳ ${Number(amount || 0).toLocaleString()}`;
}

/**
 * Send request to Discord with retry on rate limit (429)
 */
async function postWithRetry(url, data, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.post(url, data);
      return response;
    } catch (err) {
      if (err.response?.status === 429 && attempt < retries) {
        const retryAfter = (err.response?.data?.retry_after || 30) * 1000;
        console.log(`[Discord] Rate limited. Retrying in ${retryAfter / 1000}s (attempt ${attempt}/${retries})`);
        await new Promise((resolve) => setTimeout(resolve, retryAfter));
      } else {
        throw err;
      }
    }
  }
}

/**
 * Send Discord notification for transaction events
 */
async function sendDiscordNotification({
  action,
  transaction,
  changes = null,
  user,
  error = null,
}) {
  const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

  if (!DISCORD_WEBHOOK_URL) {
    console.log('[Discord] Webhook URL not configured, skipping notification');
    return;
  }

  try {
    let embed = {};

    if (action === 'CREATE_TRANSACTION') {
      embed = {
        title: '✅ Transaction Created',
        color: 3066993,
        fields: [
          { name: 'Ledger', value: transaction.ledgerId?.name || 'N/A', inline: true },
          { name: 'Type', value: transaction.type?.toUpperCase() || 'N/A', inline: true },
          { name: 'Amount', value: formatBDT(transaction.amount), inline: true },
          {
            name: 'Date',
            value: new Date(transaction.date).toLocaleDateString('en-US', {
              year: 'numeric', month: 'short', day: 'numeric',
            }),
            inline: true,
          },
          { name: 'Description', value: transaction.description || '-', inline: false },
          {
            name: 'Created By',
            value: `${user?.username || 'Unknown'} (${user?.role || 'N/A'})`,
            inline: true,
          },
        ],
        timestamp: new Date().toISOString(),
      };
    } else if (action === 'UPDATE_TRANSACTION') {
      const changeFields = [];
      if (changes) {
        for (const field of Object.keys(changes.after || {})) {
          const before = changes.before?.[field];
          const after = changes.after?.[field];
          if (before !== after) {
            changeFields.push({
              name: `${field}:`,
              value: `**Before:** ${before || '-'}\n**After:** ${after || '-'}`,
              inline: false,
            });
          }
        }
      }
      embed = {
        title: '📝 Transaction Updated',
        color: 15105570,
        fields: [
          { name: 'Ledger', value: transaction.ledgerId?.name || 'N/A', inline: true },
          { name: 'Amount', value: formatBDT(transaction.amount), inline: true },
          ...changeFields,
          {
            name: 'Updated By',
            value: `${user?.username || 'Unknown'} (${user?.role || 'N/A'})`,
            inline: true,
          },
        ],
        timestamp: new Date().toISOString(),
      };
    } else if (action === 'DELETE_TRANSACTION') {
      embed = {
        title: '🗑️ Transaction Deleted',
        color: 15158332,
        fields: [
          { name: 'Ledger', value: transaction.ledgerId?.name || 'N/A', inline: true },
          { name: 'Type', value: transaction.type?.toUpperCase() || 'N/A', inline: true },
          { name: 'Amount', value: formatBDT(transaction.amount), inline: true },
          {
            name: 'Deleted By',
            value: `${user?.username || 'Unknown'} (${user?.role || 'N/A'})`,
            inline: true,
          },
        ],
        timestamp: new Date().toISOString(),
      };
    }

    if (error) {
      embed.color = 15158332;
      embed.title = `❌ ${action} - Failed`;
      embed.fields = [
        ...(embed.fields || []),
        { name: 'Error', value: error.message || 'Unknown error', inline: false },
      ];
    }

    await postWithRetry(DISCORD_WEBHOOK_URL, {
      embeds: [embed],
      username: 'M/S Kamrul Traders - Transaction Bot',
    });

    console.log(`[Discord] Notification sent for ${action}`);
  } catch (err) {
    console.error('[Discord] Failed to send notification:', err.message);
  }
}

module.exports = {
  sendDiscordNotification,
};

