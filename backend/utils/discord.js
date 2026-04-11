const axios = require('axios');

/**
 * Format BDT currency
 */
function formatBDT(amount) {
  return `৳ ${Number(amount || 0).toLocaleString()}`;
}

/**
 * Send Discord notification for transaction events
 */
async function sendDiscordNotification({
  action, // 'CREATE_TRANSACTION', 'UPDATE_TRANSACTION', 'DELETE_TRANSACTION'
  transaction,
  changes = null, // For updates: { before: {...}, after: {...} }
  user,
  error = null,
}) {
  const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

  console.log(`[Discord] Attempting to send notification for action: ${action}`);
  console.log(`[Discord] Webhook URL configured: ${DISCORD_WEBHOOK_URL ? 'YES (' + DISCORD_WEBHOOK_URL.substring(0, 50) + '...)' : 'NO'}`);

  // Skip if webhook is not configured
  if (!DISCORD_WEBHOOK_URL) {
    console.log('[Discord] Webhook URL not configured, skipping notification');
    return;
  }

  try {
    let embed = {};
    let actionDescription = '';

    if (action === 'CREATE_TRANSACTION') {
      actionDescription = '✅ Transaction Created';
      embed = {
        title: actionDescription,
        color: 3066993, // Green
        fields: [
          {
            name: 'Ledger',
            value: transaction.ledgerId?.name || 'N/A',
            inline: true,
          },
          {
            name: 'Type',
            value: transaction.type?.toUpperCase() || 'N/A',
            inline: true,
          },
          {
            name: 'Amount',
            value: formatBDT(transaction.amount),
            inline: true,
          },
          {
            name: 'Date',
            value: new Date(transaction.date).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            }),
            inline: true,
          },
          {
            name: 'Description',
            value: transaction.description || '-',
            inline: false,
          },
          {
            name: 'Created By',
            value: `${user?.username || 'Unknown'} (${user?.role || 'N/A'})`,
            inline: true,
          },
        ],
        timestamp: new Date().toISOString(),
      };
    } else if (action === 'UPDATE_TRANSACTION') {
      actionDescription = '📝 Transaction Updated';
      const changeFields = [];

      if (changes) {
        const changedFields = Object.keys(changes.after || {});
        for (const field of changedFields) {
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
        title: actionDescription,
        color: 15105570, // Orange
        fields: [
          {
            name: 'Ledger',
            value: transaction.ledgerId?.name || 'N/A',
            inline: true,
          },
          {
            name: 'Amount',
            value: formatBDT(transaction.amount),
            inline: true,
          },
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
      actionDescription = '🗑️ Transaction Deleted';
      embed = {
        title: actionDescription,
        color: 15158332, // Red
        fields: [
          {
            name: 'Ledger',
            value: transaction.ledgerId?.name || 'N/A',
            inline: true,
          },
          {
            name: 'Type',
            value: transaction.type?.toUpperCase() || 'N/A',
            inline: true,
          },
          {
            name: 'Amount',
            value: formatBDT(transaction.amount),
            inline: true,
          },
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
      embed.color = 15158332; // Red for errors
      embed.title = `❌ ${action} - Failed`;
      embed.fields = [
        ...(embed.fields || []),
        {
          name: 'Error',
          value: error.message || 'Unknown error',
          inline: false,
        },
      ];
    }

    // Send to Discord
    await axios.post(DISCORD_WEBHOOK_URL, {
      embeds: [embed],
      username: 'M/S Kamrul Traders - Transaction Bot',
    });

    console.log(`[Discord] Notification sent for ${action}`);
  } catch (err) {
    console.error('[Discord] Failed to send notification:', err.message);
    // Don't throw - we don't want Discord failures to block transactions
  }
}

module.exports = {
  sendDiscordNotification,
};
