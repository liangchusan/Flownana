/**
 * 临时脚本：重置指定用户的订阅状态（用于测试）
 * 用法：npx tsx scripts/reset-subscription.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TARGET_EMAIL = "liangchusan@gmail.com";

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: TARGET_EMAIL },
    include: { subscriptions: true },
  });

  if (!user) {
    console.log(`❌ 未找到用户: ${TARGET_EMAIL}`);
    return;
  }

  console.log(`✅ 找到用户: ${user.id} (${user.email})`);
  console.log("当前订阅:", JSON.stringify(user.subscriptions, null, 2));

  if (!user.subscriptions || user.subscriptions.length === 0) {
    console.log("ℹ️  该用户没有订阅记录，无需操作。");
    return;
  }

  // 删除所有订阅记录
  const deleted = await prisma.subscription.deleteMany({ where: { userId: user.id } });
  console.log(`✅ 已删除 ${deleted.count} 条订阅记录。`);

  // 查询剩余积分
  const batches = await prisma.creditBatch.findMany({
    where: { userId: user.id },
    orderBy: { expiresAt: "asc" },
  });
  const total = batches.reduce((sum, b) => sum + b.remaining, 0);
  console.log(`ℹ️  当前积分余额: ${total}（共 ${batches.length} 批次，未清除）`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
