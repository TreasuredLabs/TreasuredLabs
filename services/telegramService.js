import { Telegraf, Scenes, session } from 'telegraf';
import { createHash } from 'crypto';

class TelegramService {
  constructor() {
    this.bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    this.apiBase = 'https://api.telegram.org/bot';
    this.channelId = '@TreasureXAlerts';
    this.adminIds = ['ADMIN_ID_1', 'ADMIN_ID_2'];
    this.premiumUsers = new Set();
    this.userStates = new Map();
    this.messageQueue = [];
    this.rateLimits = new Map();
    
    this.initializeBot();
  }

  async initializeBot() {
    // Set up middleware
    this.bot.use(session());
    this.bot.use(this.rateLimitMiddleware.bind(this));
    this.bot.use(this.authMiddleware.bind(this));

    // Command handlers
    this.setupCommandHandlers();
    
    // Scene management
    this.setupScenes();

    // Error handling
    this.setupErrorHandling();

    // Start bot
    this.bot.launch();
    console.log('TreasureX Bot initialized');

    // Enable graceful stop
    process.once('SIGINT', () => this.bot.stop('SIGINT'));
    process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
  }

  private setupCommandHandlers() {
    this.bot.command('start', this.handleStart.bind(this));
    this.bot.command('scan', this.handleScan.bind(this));
    this.bot.command('subscribe', this.handleSubscribe.bind(this));
    this.bot.command('alerts', this.handleAlerts.bind(this));
    this.bot.command('premium', this.handlePremium.bind(this));
    this.bot.command('help', this.handleHelp.bind(this));
    
    // Admin commands
    this.bot.command('broadcast', this.handleBroadcast.bind(this));
    this.bot.command('stats', this.handleStats.bind(this));
    this.bot.command('ban', this.handleBan.bind(this));
  }

  private setupScenes() {
    const scanScene = new Scenes.WizardScene(
      'scan',
      this.scanStep1.bind(this),
      this.scanStep2.bind(this),
      this.scanStep3.bind(this)
    );

    const subscribeScene = new Scenes.WizardScene(
      'subscribe',
      this.subscribeStep1.bind(this),
      this.subscribeStep2.bind(this)
    );

    const stage = new Scenes.Stage([scanScene, subscribeScene]);
    this.bot.use(stage.middleware());
  }

  private setupErrorHandling() {
    this.bot.catch((err, ctx) => {
      console.error('Bot error:', err);
      this.logError(err, ctx);
      ctx.reply('An error occurred. Our team has been notified.');
    });
  }

  async verifyUser(username) {
    try {
      const user = await this.getUserData(username);
      if (!user) return { success: false, error: 'User not found' };

      const verificationHash = this.generateVerificationHash(username);
      await this.storeVerification(username, verificationHash);

      const subscriptionStatus = await this.checkSubscriptionStatus(username);
      const membershipData = await this.getMembershipData(username);

      return {
        success: true,
        userData: {
          username,
          verificationHash,
          memberSince: membershipData.joinDate,
          subscription: subscriptionStatus,
          preferences: membershipData.preferences,
          alertSettings: membershipData.alertSettings
        }
      };
    } catch (error) {
      console.error('Verification failed:', error);
      return { success: false, error: error.message };
    }
  }

  async sendAlert(type, data) {
    try {
      const message = this.formatAlertMessage(type, data);
      const keyboard = this.generateAlertKeyboard(type, data);

      // Rate limiting check
      if (this.shouldThrottleAlert(type)) {
        this.queueAlert(message, keyboard);
        return;
      }

      // Send to different channels based on priority
      if (data.priority === 'high') {
        await this.sendPriorityAlert(message, keyboard);
      } else {
        await this.sendRegularAlert(message, keyboard);
      }

      // Log alert
      await this.logAlertMetrics(type, data);
    } catch (error) {
      console.error('Alert sending failed:', error);
      throw error;
    }
  }

  private async sendPriorityAlert(message, keyboard) {
    const premiumUsers = await this.getPremiumUsers();
    for (const user of premiumUsers) {
      try {
        await this.bot.telegram.sendMessage(user.id, message, {
          parse_mode: 'HTML',
          reply_markup: keyboard,
          disable_web_page_preview: true
        });
      } catch (error) {
        console.error(`Failed to send to user ${user.id}:`, error);
      }
    }
  }

  private formatAlertMessage(type, data) {
    const templates = {
      priceAlert: this.getPriceAlertTemplate(),
      whaleAlert: this.getWhaleAlertTemplate(),
      securityAlert: this.getSecurityAlertTemplate(),
      trendingAlert: this.getTrendingAlertTemplate()
    };

    return templates[type](data);
  }

  private generateAlertKeyboard(type, data) {
    // Generate inline keyboard based on alert type
    return {
      inline_keyboard: [
        [
          { text: '📊 View Chart', url: data.chartUrl },
          { text: '💰 Trade Now', url: data.tradeUrl }
        ],
        [
          { text: '🔍 Scan Contract', callback_data: `scan_${data.contractAddress}` },
          { text: '⭐ Save', callback_data: `save_${data.alertId}` }
        ]
      ]
    };
  }

  // Many more private methods for handling different aspects of the bot...

  private async rateLimitMiddleware(ctx, next) {
    const userId = ctx.from?.id;
    if (!userId) return next();

    const now = Date.now();
    const userLimit = this.rateLimits.get(userId) || { count: 0, timestamp: now };

    if (now - userLimit.timestamp < 60000) { // 1 minute window
      if (userLimit.count >= 20) { // 20 messages per minute
        return ctx.reply('Rate limit exceeded. Please wait a minute.');
      }
      userLimit.count++;
    } else {
      userLimit.count = 1;
      userLimit.timestamp = now;
    }

    this.rateLimits.set(userId, userLimit);
    return next();
  }

  private async authMiddleware(ctx, next) {
    const userId = ctx.from?.id;
    if (!userId) return next();

    const userState = this.userStates.get(userId) || await this.loadUserState(userId);
    ctx.state.user = userState;

    return next();
  }
}

export default new TelegramService(); 