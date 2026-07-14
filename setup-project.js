const fs = require('fs');
const path = require('path');

// 1. تحديد هيكلية المجلدات الشجرية للمنصة
const directories = [
  'prisma',
  'apps/api/src/facebook',
  'apps/api/src/flows',
  'apps/api/src/prisma',
  'apps/web/components/builder/nodes',
  'apps/web/components/livechat',
  'apps/web/app/chat',
  'apps/web/app/builder'
];

// 2. محتويات الملفات البرمجية لتعبئتها تلقائياً
const files = {
  // أ. ملف الإعدادات البيئية لربط الخدمات
  '.env': `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/messenger_platform?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="super-secure-production-ready-jwt-signing-key"
JWT_REFRESH_SECRET="super-secure-refresh-key"
FB_APP_ID="your_facebook_app_id"
FB_APP_SECRET="your_facebook_app_secret"
FB_VERIFY_TOKEN="your_custom_webhook_verification_token"
NEXT_PUBLIC_API_WS_URL="http://localhost:3001"`,

  // ب. ملف Docker Compose للبيئة المحلية
  'docker-compose.yml': `version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    container_name: m_postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: messenger_platform
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
  redis:
    image: redis:7-alpine
    container_name: m_redis
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data
volumes:
  pgdata:
  redisdata:`,

  // ج. قاعدة البيانات ومخطط Prisma المعتمد للمؤسسات
  'prisma/schema.prisma': `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum UserRole {
  SUPER_ADMIN
  WORKSPACE_OWNER
  WORKSPACE_ADMIN
  WORKSPACE_MEMBER
  WORKSPACE_VIEWER
}

model User {
  id                    String            @id @default(uuid())
  email                 String            @unique
  passwordHash          String?
  firstName             String
  lastName              String
  avatarUrl             String?
  isEmailVerified       Boolean           @default(false)
  twoFactorEnabled      Boolean           @default(false)
  twoFactorSecret       String?
  createdAt             DateTime          @default(now())
  updatedAt             DateTime          @updatedAt
  memberships           WorkspaceMember[]
  apiTokens             ApiToken[]
  auditLogs             AuditLog[]
  activityLogs          ActivityLog[]
  assignedConversations Conversation[]    @relation("AssignedAgent")
  tickets               SupportTicket[]
}

model Workspace {
  id                  String               @id @default(uuid())
  name                String
  slug                String               @unique
  createdAt           DateTime             @default(now())
  updatedAt           DateTime             @updatedAt
  members             WorkspaceMember[]
  pages               FacebookPage[]
  flows               Flow[]
  tags                Tag[]
  customFieldSchemas  CustomFieldSchema[]
  broadcasts          Broadcast[]
  commentAutomations  CommentAutomation[]
  auditLogs           AuditLog[]
  activityLogs        ActivityLog[]
  apiTokens           ApiToken[]
  subscription        Subscription?
}

model WorkspaceMember {
  id          String    @id @default(uuid())
  workspaceId String
  userId      String
  role        UserRole  @default(WORKSPACE_MEMBER)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([workspaceId, userId])
}

model ApiToken {
  id          String    @id @default(uuid())
  workspaceId String
  userId      String
  name        String
  tokenHash   String    @unique
  scopes      String[]
  expiresAt   DateTime?
  createdAt   DateTime  @default(now())
  lastUsedAt  DateTime?
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model FacebookPage {
  id                  String               @id
  workspaceId         String
  name                String
  accessToken         String
  category            String?
  instagramId         String?
  isActive            Boolean              @default(true)
  createdAt           DateTime             @default(now())
  updatedAt           DateTime             @updatedAt
  workspace           Workspace            @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  subscribers         Subscriber[]
  conversations       Conversation[]
  broadcasts          Broadcast[]
  commentAutomations  CommentAutomation[]
  webhookLogs         WebhookLog[]
  @@index([workspaceId])
}

model Subscriber {
  id                  String               @id @default(uuid())
  facebookPageId      String
  psid                String
  firstName           String?
  lastName            String?
  profilePic          String?
  locale              String?
  timezone            Int?
  gender              String?
  isActive            Boolean              @default(true)
  optedInAt           DateTime             @default(now())
  updatedAt           DateTime             @updatedAt
  facebookPage        FacebookPage         @relation(fields: [facebookPageId], references: [id], onDelete: Cascade)
  conversations       Conversation[]
  tagMappings         SubscriberTag[]
  customFields        SubscriberCustomField[]
  broadcastLogs       BroadcastLog[]
  @@unique([facebookPageId, psid])
  @@index([psid])
}

model Tag {
  id                  String               @id @default(uuid())
  workspaceId         String
  name                String
  color               String               @default("#3B82F6")
  createdAt           DateTime             @default(now())
  workspace           Workspace            @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  subscribers         SubscriberTag[]
  @@unique([workspaceId, name])
}

model SubscriberTag {
  subscriberId        String
  tagId               String
  assignedAt          DateTime             @default(now())
  subscriber          Subscriber           @relation(fields: [subscriberId], references: [id], onDelete: Cascade)
  tag                 Tag                  @relation(fields: [tagId], references: [id], onDelete: Cascade)
  @@id([subscriberId, tagId])
}

model CustomFieldSchema {
  id                  String               @id @default(uuid())
  workspaceId         String
  key                 String
  type                String
  createdAt           DateTime             @default(now())
  workspace           Workspace            @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  values              SubscriberCustomField[]
  @@unique([workspaceId, key])
}

model SubscriberCustomField {
  id                  String               @id @default(uuid())
  subscriberId        String
  schemaId            String
  value               String
  updatedAt           DateTime             @updatedAt
  subscriber          Subscriber           @relation(fields: [subscriberId], references: [id], onDelete: Cascade)
  schema              CustomFieldSchema    @relation(fields: [schemaId], references: [id], onDelete: Cascade)
  @@unique([subscriberId, schemaId])
}

model Flow {
  id                  String               @id @default(uuid())
  workspaceId         String
  name                String
  description         String?
  triggerType         String
  triggerKeywords     String[]
  isPublished         Boolean              @default(false)
  createdAt           DateTime             @default(now())
  updatedAt           DateTime             @updatedAt
  workspace           Workspace            @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  nodes               FlowNode[]
  connections         FlowConnection[]
  versions            FlowVersion[]
  conversations       Conversation[]
}

model FlowNode {
  id                  String               @id
  flowId              String
  type                String
  data                Json
  positionX           Float
  positionY           Float
  flow                Flow                 @relation(fields: [flowId], references: [id], onDelete: Cascade)
  @@index([flowId])
}

model FlowConnection {
  id                  String               @id @default(uuid())
  flowId              String
  sourceNodeId        String
  targetNodeId        String
  sourcePort          String?
  targetPort          String?
  flow                Flow                 @relation(fields: [flowId], references: [id], onDelete: Cascade)
  @@index([flowId])
}

model FlowVersion {
  id                  String               @id @default(uuid())
  flowId              String
  versionNumber       Int
  nodesData           Json
  connectionsData     Json
  createdAt           DateTime             @default(now())
  flow                Flow                 @relation(fields: [flowId], references: [id], onDelete: Cascade)
  @@index([flowId])
}

enum ConversationStatus {
  OPEN
  PENDING
  CLOSED
}

model Conversation {
  id                  String               @id @default(uuid())
  facebookPageId      String
  subscriberId        String
  status              ConversationStatus   @default(OPEN)
  assignedUserId      String?
  activeFlowId        String?
  lastMessageAt       DateTime             @default(now())
  createdAt           DateTime             @default(now())
  updatedAt           DateTime             @updatedAt
  facebookPage        FacebookPage         @relation(fields: [facebookPageId], references: [id], onDelete: Cascade)
  subscriber          Subscriber           @relation(fields: [subscriberId], references: [id], onDelete: Cascade)
  assignedAgent       User?                @relation("AssignedAgent", fields: [assignedUserId], references: [id], onDelete: SetNull)
  activeFlow          Flow?                @relation(fields: [activeFlowId], references: [id], onDelete: SetNull)
  messages            Message[]
  @@index([facebookPageId, subscriberId])
}

model Message {
  id                  String               @id @default(uuid())
  conversationId      String
  mid                 String?              @unique
  senderId            String
  recipientId         String
  isFromSubscriber    Boolean
  text                String?
  attachments         Json?
  sentAt              DateTime             @default(now())
  conversation        Conversation         @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  @@index([conversationId])
}

model CommentAutomation {
  id                    String             @id @default(uuid())
  workspaceId           String
  facebookPageId        String
  name                  String
  postId                String?
  triggerKeywords       String[]
  excludeKeywords       String[]
  replyText             String
  privateReplyFlowId    String?
  likeComment           Boolean            @default(false)
  hideComment           Boolean            @default(false)
  deleteComment         Boolean            @default(false)
  replyOncePerUser      Boolean            @default(true)
  delaySeconds          Int                @default(0)
  createdAt             DateTime           @default(now())
  updatedAt             DateTime           @updatedAt
  workspace             Workspace          @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  facebookPage          FacebookPage       @relation(fields: [facebookPageId], references: [id], onDelete: Cascade)
}

enum BroadcastStatus {
  DRAFT
  SCHEDULED
  PROCESSING
  COMPLETED
  FAILED
  PAUSED
}

model Broadcast {
  id                  String               @id @default(uuid())
  workspaceId         String
  facebookPageId      String
  name                String
  targetTags          String[]
  targetLocales       String[]
  messageText         String
  mediaUrl            String?
  scheduledAt         DateTime?
  status              BroadcastStatus      @default(DRAFT)
  sentCount           Int                  @default(0)
  deliveredCount      Int                  @default(0)
  failedCount         Int                  @default(0)
  createdAt           DateTime             @default(now())
  updatedAt           DateTime             @updatedAt
  workspace           Workspace            @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  facebookPage        FacebookPage         @relation(fields: [facebookPageId], references: [id], onDelete: Cascade)
  logs                BroadcastLog[]
  @@index([workspaceId])
}

model BroadcastLog {
  id                  String               @id @default(uuid())
  broadcastId         String
  subscriberId        String
  status              String
  errorMessage        String?
  processedAt         DateTime             @default(now())
  broadcast           Broadcast            @relation(fields: [broadcastId], references: [id], onDelete: Cascade)
  subscriber          Subscriber           @relation(fields: [subscriberId], references: [id], onDelete: Cascade)
  @@unique([broadcastId, subscriberId])
}

model Plan {
  id                  String               @id @default(uuid())
  name                String
  stripeProductId     String               @unique
  stripePriceId       String               @unique
  priceAmount         Float
  currency            String               @default("usd")
  maxPages            Int                  @default(1)
  maxSubscribers      Int                  @default(100)
  createdAt           DateTime             @default(now())
  updatedAt           DateTime             @updatedAt
  subscriptions       Subscription[]
}

model Subscription {
  id                  String               @id @default(uuid())
  workspaceId         String               @unique
  planId              String
  stripeCustomerId    String
  stripeSubscriptionId String              @unique
  status              String
  currentPeriodStart  DateTime
  currentPeriodEnd    DateTime
  createdAt           DateTime             @default(now())
  updatedAt           DateTime             @updatedAt
  workspace           Workspace            @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  plan                Plan                 @relation(fields: [planId], references: [id])
}

model WebhookLog {
  id                  String               @id @default(uuid())
  facebookPageId      String?
  payload             Json
  processingTimeMs    Int
  createdAt           DateTime             @default(now())
  facebookPage        FacebookPage?        @relation(fields: [facebookPageId], references: [id], onDelete: Cascade)
}

model AuditLog {
  id                  String               @id @default(uuid())
  workspaceId         String
  userId              String?
  action              String
  entityType          String
  entityId            String
  details             Json?
  ipAddress           String?
  createdAt           DateTime             @default(now())
  workspace           Workspace            @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  user                User?                @relation(fields: [userId], references: [id], onDelete: SetNull)
}

model ActivityLog {
  id                  String               @id @default(uuid())
  workspaceId         String
  userId              String
  description         String
  createdAt           DateTime             @default(now())
  workspace           Workspace            @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  user                User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model SupportTicket {
  id                  String               @id @default(uuid())
  userId              String
  subject             String
  description         String
  status              String
  createdAt           DateTime             @default(now())
  user                User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
}`,

  // د. ملف NestJS Webhook Controller لتنظيم التنبيهات من Facebook API
  'apps/api/src/facebook/facebook.controller.ts': `import { Controller, Get, Post, Body, Query, HttpCode, HttpStatus, Req, BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import * as crypto from 'crypto';

@Controller('webhooks/facebook')
export class FacebookWebhookController {
  constructor(
    @InjectQueue('facebook-webhooks') private readonly webhookQueue: Queue
  ) {}

  @Get()
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string
  ) {
    const verifyToken = process.env.FB_VERIFY_TOKEN;
    if (mode === 'subscribe' && token === verifyToken) {
      return challenge;
    }
    throw new BadRequestException('Verification failed');
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Req() req: Request, @Body() body: any) {
    const signature = req.headers['x-hub-signature-256'] as string;
    if (!this.verifySignature(signature, (req as any).rawBody, process.env.FB_APP_SECRET || '')) {
      throw new BadRequestException('Invalid signature');
    }

    if (body.object === 'page') {
      for (const entry of body.entry) {
        await this.webhookQueue.add('process-entry', entry, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: true,
        });
      }
    }
    return { success: true };
  }

  private verifySignature(signature: string, rawBody: Buffer, appSecret: string): boolean {
    if (!signature || !rawBody) return false;
    const [algo, hash] = signature.split('=');
    if (algo !== 'sha256') return false;
    const expectedHash = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expectedHash));
  }
}`
};

// 3. بناء هيكل المجلدات الفعلي
console.log('🏗️  جاري إنشاء هيكل مجلدات المنصة...');
directories.forEach(dir => {
  fs.mkdirSync(path.join(__dirname, dir), { recursive: true });
});

// 4. كتابة الملفات المضمنة بالأعلى
console.log('✍️  جاري ملء وكتابة ملفات المشروع الأساسية...');
Object.entries(files).forEach(([filePath, content]) => {
  const absolutePath = path.join(__dirname, filePath);
  fs.writeFileSync(absolutePath, content.trim(), 'utf8');
  console.log(` ✅ تم توليد الملف: ${filePath}`);
});

console.log('\n🌟 تم تأسيس بنية المشروع بنجاح! جاهز للتطوير الشامل.');
