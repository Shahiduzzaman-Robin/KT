const https = require('https');

/**
 * Format BDT currency
 */
function formatBDT(amount) {
  return `৳ ${Number(amount || 0).toLocaleString()}`;
}

/**
 * Send webhook using native https
 * Tries alternative Discord domains to bypass Cloudflare rate limits on shared hosting
 */
async function postToDiscord(webhookUrl, data) {
  const domains = [
    'discordapp.com',
    'canary.discord.com',
    'ptb.discord.com',
    'discord.com',
  ];

  // Extract the path from the webhook URL
  const originalUrl = new URL(webhookUrl);
  const webhookPath = originalUrl.pathname;

  for (const domain of domains) {
    try {
      const result = await sendHttps(domain, webhookPath, data);
      console.log(`[Discord] Successfully sent via ${domain}`);
      return result;
    } catch (err) {
      console.log(`[Discord] Failed via ${domain}: ${err.message}`);
      if (domain === domains[domains.length - 1]) throw err;
    }
  }
}

function sendHttps(hostname, path, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);

    const options = {
      hostname,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'User-Agent': 'KamrulTradersBot/1.0 (Node.js; +https://kt-jz1b.onrender.com)',
        'Accept': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: res.statusCode, data: body });
        } else {
          const error = new Error(`${res.statusCode}: ${body}`);
          error.status = res.statusCode;
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Send Discord notification for transaction and ledger events
 */
async function sendDiscordNotification({
  action,
  transaction,
  ledger,
  changes = null,
  user,
  error = null,
}) {
  // Use specific webhook for ledgers if provided, otherwise fallback to transaction webhook
  const isLedgerAction = action.includes('LEDGER');
  const DISCORD_WEBHOOK_URL = isLedgerAction 
    ? (process.env.DISCORD_LEDGER_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL)
    : process.env.DISCORD_WEBHOOK_URL;

  if (!DISCORD_WEBHOOK_URL) {
    console.log(`[Discord] Webhook URL for ${isLedgerAction ? 'Ledger' : 'Transaction'} not configured, skipping notification`);
    return;
  }

  const botName = isLedgerAction 
    ? 'M/S Kamrul Traders - Ledger Bot' 
    : 'M/S Kamrul Traders - Transaction Bot';

  try {
    let embed = {};

    // --- TRANSACTION ACTIONS ---
    if (action === 'CREATE_TRANSACTION') {
      const color = transaction.type === 'income' ? 3447003 : 16776960; // Blue for Income, Yellow for Outgoing
      embed = {
        title: '✅ Transaction Created',
        color: color,
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
    // --- LEDGER ACTIONS ---
    else if (action === 'CREATE_LEDGER') {
      embed = {
        title: '📁 Ledger Created',
        color: 3066993, // Green
        fields: [
          { name: 'Name', value: ledger.name || 'N/A', inline: true },
          { name: 'Type', value: ledger.type?.toUpperCase() || 'N/A', inline: true },
          { name: 'Posting', value: ledger.isPosting ? 'Yes' : 'No', inline: true },
          { name: 'Contact', value: ledger.contact || '-', inline: true },
          {
            name: 'Created By',
            value: `${user?.username || 'Unknown'} (${user?.role || 'N/A'})`,
            inline: true,
          },
        ],
        timestamp: new Date().toISOString(),
      };
    } else if (action === 'UPDATE_LEDGER') {
      const changeFields = [];
      if (changes) {
        for (const field of Object.keys(changes.after || {})) {
          const before = changes.before?.[field];
          const after = changes.after?.[field];
          if (String(before) !== String(after)) {
            changeFields.push({
              name: `${field}:`,
              value: `**Before:** ${before || '-'}\n**After:** ${after || '-'}`,
              inline: false,
            });
          }
        }
      }
      embed = {
        title: '📁 Ledger Updated',
        color: 15105570, // Orange
        fields: [
          { name: 'Name', value: ledger.name || 'N/A', inline: true },
          ...changeFields,
          {
            name: 'Updated By',
            value: `${user?.username || 'Unknown'} (${user?.role || 'N/A'})`,
            inline: true,
          },
        ],
        timestamp: new Date().toISOString(),
      };
    } else if (action === 'DELETE_LEDGER' || action === 'ARCHIVE_LEDGER') {
      const isArchive = action === 'ARCHIVE_LEDGER';
      embed = {
        title: isArchive ? '🗄️ Ledger Archived' : '🗑️ Ledger Deleted',
        color: 15158332, // Red
        fields: [
          { name: 'Name', value: ledger.name || 'N/A', inline: true },
          { name: 'Type', value: ledger.type?.toUpperCase() || 'N/A', inline: true },
          {
            name: isArchive ? 'Archived By' : 'Deleted By',
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

    await postToDiscord(DISCORD_WEBHOOK_URL, {
      embeds: [embed],
      username: botName,
    });

    console.log(`[Discord] Notification sent for ${action}`);
  } catch (err) {
    console.error('[Discord] Failed to send notification:', err.message);
  }
}

module.exports = {
  sendDiscordNotification,
};

