// ============================================================================
// Seed data for Jewellery Production Tracking System
// Run: npx prisma db seed
// Requires in package.json:
//   "prisma": { "seed": "ts-node prisma/seed.ts" }
// ============================================================================

import { PrismaClient } from '@prisma/client';
import { UserRole, CustomerType, Priority, OrderStatus,
         MetalType, MetalColor, StageStatus } from '../src/lib/enums';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Helper: add days to a date
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

async function main() {
  console.log('Seeding database...');

  // --------------------------------------------------------------------------
  // 1. USERS
  // --------------------------------------------------------------------------
  const hash = (pw: string) => bcrypt.hashSync(pw, 10);

  const [admin, sales, deptHead, qc] = await Promise.all([
    prisma.user.upsert({
      where: { email: 'admin@mitva.local' },
      update: {},
      create: {
        name: 'Aniket (Owner)',
        email: 'admin@mitva.local',
        passwordHash: hash('admin123'),
        role: UserRole.ADMIN,
      },
    }),
    prisma.user.upsert({
      where: { email: 'sales@mitva.local' },
      update: {},
      create: {
        name: 'Sales Desk',
        email: 'sales@mitva.local',
        passwordHash: hash('sales123'),
        role: UserRole.SALES,
      },
    }),
    prisma.user.upsert({
      where: { email: 'production@mitva.local' },
      update: {},
      create: {
        name: 'Production Head',
        email: 'production@mitva.local',
        passwordHash: hash('prod123'),
        role: UserRole.DEPARTMENT_HEAD,
      },
    }),
    prisma.user.upsert({
      where: { email: 'qc@mitva.local' },
      update: {},
      create: {
        name: 'QC Inspector',
        email: 'qc@mitva.local',
        passwordHash: hash('qc123'),
        role: UserRole.QC,
      },
    }),
  ]);

  // --------------------------------------------------------------------------
  // 2. STAGES (master workflow)
  // --------------------------------------------------------------------------
  const stageData = [
    { code: 'BOOK',  name: 'Order Booking',       sequence: 1,  slaDays: 0.5, department: 'Sales' },
    { code: 'CAD',   name: 'CAD Designing',       sequence: 2,  slaDays: 2,   department: 'Design' },
    { code: 'RPT',   name: 'RPT (Wax / Prototype)', sequence: 3, slaDays: 1,   department: 'Prototype' },
    { code: 'CAST',  name: 'Casting',             sequence: 4,  slaDays: 1,   department: 'Casting' },
    { code: 'FILE',  name: 'Filing',              sequence: 5,  slaDays: 2,   department: 'Filing' },
    { code: 'PREPOL',name: 'Pre-Polishing',       sequence: 6,  slaDays: 1,   department: 'Polishing' },
    { code: 'SET',   name: 'Diamond Setting',     sequence: 7,  slaDays: 3,   department: 'Setting' },
    { code: 'POL',   name: 'Final Polish',        sequence: 8,  slaDays: 1,   department: 'Polishing' },
    { code: 'RHOD',  name: 'Rhodium Plating',     sequence: 9,  slaDays: 0.5, department: 'Plating' },
    { code: 'QC',    name: 'QC & Labelling',      sequence: 10, slaDays: 0.5, department: 'QC' },
    { code: 'DISP',  name: 'Dispatch',            sequence: 11, slaDays: 0.5, department: 'Dispatch' },
  ];

  const stages: Record<string, any> = {};
  for (const s of stageData) {
    stages[s.code] = await prisma.stage.upsert({
      where: { code: s.code },
      update: {},
      create: s,
    });
  }

  // --------------------------------------------------------------------------
  // 3. KARIGARS (workers)
  // --------------------------------------------------------------------------
  const karigarData = [
    { name: 'Ramesh Soni',   department: 'Design',    phone: '9812300001' },
    { name: 'Suresh Bhai',   department: 'Prototype', phone: '9812300002' },
    { name: 'Mahesh Kumar',  department: 'Casting',   phone: '9812300003' },
    { name: 'Dinesh Patel',  department: 'Filing',    phone: '9812300004' },
    { name: 'Jignesh Shah',  department: 'Polishing', phone: '9812300005' },
    { name: 'Kiran Verma',   department: 'Setting',   phone: '9812300006' },
    { name: 'Rahul Mehta',   department: 'Setting',   phone: '9812300007' },
    { name: 'Vijay Jain',    department: 'Plating',   phone: '9812300008' },
    { name: 'Anita Desai',   department: 'QC',        phone: '9812300009' },
  ];

  const karigars: any[] = [];
  for (const k of karigarData) {
    const existing = await prisma.karigar.findFirst({ where: { name: k.name } });
    const kar = existing
      ? existing
      : await prisma.karigar.create({ data: { ...k, joinedOn: new Date('2024-01-01') } });
    karigars.push(kar);
  }

  // --------------------------------------------------------------------------
  // 4. CUSTOMERS
  // --------------------------------------------------------------------------
  const customerData = [
    { name: 'Shreeji Jewellers',   phone: '9898111111', email: 'shreeji@example.com',
      type: CustomerType.WHOLESALE, address: 'Zaveri Bazaar, Mumbai', gstNo: '27ABCDE1234F1Z5' },
    { name: 'Priya Sharma',        phone: '9898222222', email: 'priya@example.com',
      type: CustomerType.END_CUSTOMER, address: 'Andheri West, Mumbai' },
    { name: 'Gold Palace Retail',  phone: '9898333333', email: 'gp@example.com',
      type: CustomerType.RETAIL, address: 'Surat, Gujarat', gstNo: '24GOLDP1234G1Z5' },
    { name: 'Anjali Verma',        phone: '9898444444',
      type: CustomerType.END_CUSTOMER, address: 'Bengaluru' },
  ];

  const customers: any[] = [];
  for (const c of customerData) {
    const existing = await prisma.customer.findFirst({ where: { name: c.name } });
    const cust = existing ? existing : await prisma.customer.create({ data: c });
    customers.push(cust);
  }

  // --------------------------------------------------------------------------
  // 5. ORDERS (with varying progress through stages)
  // --------------------------------------------------------------------------
  const today = new Date();

  // Helper to find karigar by department
  const karBy = (dept: string) => karigars.find(k => k.department === dept);

  // ---- Order 1: Completed up to Setting, currently in Final Polish ----
  const order1 = await prisma.order.upsert({
    where: { jobNo: '2604-0001' },
    update: {},
    create: {
      jobNo: '2604-0001',
      customerId: customers[0].id,
      orderDate: addDays(today, -12),
      expectedDelivery: addDays(today, 3),
      priority: Priority.NORMAL,
      status: OrderStatus.IN_PROGRESS,
      metal: MetalType.GOLD_18K,
      color: MetalColor.WHITE,
      qty: 1,
      grossWtEst: 8.500,
      quotedPrice: 85000,
      advancePaid: 25000,
      specialNotes: 'Customer-supplied centre diamond 0.50ct VS1',
      createdById: sales.id,
      currentStageId: stages.POL.id,
      items: {
        create: [{
          description: 'Solitaire diamond engagement ring',
          size: 'US 6',
          qty: 1,
          stonesJson: JSON.stringify([
            { type: 'Diamond', shape: 'Round', size: '5.2mm', qty: 1, quality: 'VS1-F', source: 'customer' },
            { type: 'Diamond', shape: 'Round', size: '1.2mm', qty: 18, quality: 'VS2-G', source: 'in-house' },
          ]),
        }],
      },
    },
  });

  // Stage history for order1
  const order1Stages: Array<[string, number, number, string, number, number]> = [
    // [stageCode, daysAgoIn, daysAgoOut, dept, wtIn, wtOut]
    ['BOOK',  12, 12,   'Sales',     0,    0],
    ['CAD',   12, 10,   'Design',    0,    0],
    ['RPT',   10, 9,    'Prototype', 0,    3.1],
    ['CAST',  9,  8,    'Casting',   3.1,  9.2],
    ['FILE',  8,  6,    'Filing',    9.2,  8.9],
    ['PREPOL',6,  5,    'Polishing', 8.9,  8.7],
    ['SET',   5,  2,    'Setting',   8.7,  8.8],
  ];
  for (const [code, dIn, dOut, dept, wIn, wOut] of order1Stages) {
    await prisma.stageHistory.create({
      data: {
        orderId: order1.id,
        stageId: stages[code].id,
        karigarId: karBy(dept)?.id,
        inAt: addDays(today, -dIn),
        outAt: addDays(today, -dOut),
        wtIn: wIn || null,
        wtOut: wOut || null,
        wtLoss: (wIn && wOut) ? Number((wIn - wOut).toFixed(3)) : null,
        status: StageStatus.COMPLETED,
        recordedById: deptHead.id,
      },
    });
  }
  // Current stage in progress
  await prisma.stageHistory.create({
    data: {
      orderId: order1.id,
      stageId: stages.POL.id,
      karigarId: karBy('Polishing')?.id,
      inAt: addDays(today, -2),
      wtIn: 8.8,
      status: StageStatus.IN_PROGRESS,
      recordedById: deptHead.id,
    },
  });

  // ---- Order 2: Just booked, currently in CAD ----
  const order2 = await prisma.order.upsert({
    where: { jobNo: '2604-0002' },
    update: {},
    create: {
      jobNo: '2604-0002',
      customerId: customers[1].id,
      orderDate: addDays(today, -2),
      expectedDelivery: addDays(today, 14),
      priority: Priority.RUSH,
      status: OrderStatus.IN_PROGRESS,
      metal: MetalType.GOLD_22K,
      color: MetalColor.YELLOW,
      qty: 2,
      grossWtEst: 22.000,
      quotedPrice: 185000,
      advancePaid: 50000,
      specialNotes: 'Anniversary gift — needed before 30th',
      createdById: sales.id,
      currentStageId: stages.CAD.id,
      items: {
        create: [{
          description: 'Pair of traditional jhumka earrings',
          qty: 2,
          stonesJson: JSON.stringify([
            { type: 'Ruby',   shape: 'Oval',  size: '3x4mm', qty: 4, source: 'in-house' },
            { type: 'Pearl',  shape: 'Drop',  size: '6mm',   qty: 2, source: 'in-house' },
          ]),
        }],
      },
    },
  });
  await prisma.stageHistory.create({
    data: {
      orderId: order2.id,
      stageId: stages.BOOK.id,
      inAt: addDays(today, -2),
      outAt: addDays(today, -2),
      status: StageStatus.COMPLETED,
      recordedById: sales.id,
    },
  });
  await prisma.stageHistory.create({
    data: {
      orderId: order2.id,
      stageId: stages.CAD.id,
      karigarId: karBy('Design')?.id,
      inAt: addDays(today, -2),
      status: StageStatus.IN_PROGRESS,
      recordedById: deptHead.id,
    },
  });

  // ---- Order 3: Fully dispatched ----
  const order3 = await prisma.order.upsert({
    where: { jobNo: '2603-0087' },
    update: {},
    create: {
      jobNo: '2603-0087',
      customerId: customers[2].id,
      orderDate: addDays(today, -28),
      expectedDelivery: addDays(today, -5),
      actualDelivery: addDays(today, -4),
      priority: Priority.NORMAL,
      status: OrderStatus.DISPATCHED,
      metal: MetalType.GOLD_22K,
      color: MetalColor.YELLOW,
      qty: 5,
      grossWtEst: 45.000,
      grossWtFinal: 44.800,
      quotedPrice: 380000,
      advancePaid: 380000,
      totalPrice: 380000,
      createdById: sales.id,
      items: {
        create: [{
          description: 'Set of 5 plain gold bangles 2.4"',
          size: '2.4"',
          qty: 5,
        }],
      },
    },
  });

  // ---- Order 4: Overdue — stuck in Setting ----
  const order4 = await prisma.order.upsert({
    where: { jobNo: '2603-0095' },
    update: {},
    create: {
      jobNo: '2603-0095',
      customerId: customers[3].id,
      orderDate: addDays(today, -20),
      expectedDelivery: addDays(today, -3), // OVERDUE
      priority: Priority.VIP,
      status: OrderStatus.IN_PROGRESS,
      metal: MetalType.GOLD_18K,
      color: MetalColor.ROSE,
      qty: 1,
      grossWtEst: 12.500,
      quotedPrice: 125000,
      advancePaid: 40000,
      specialNotes: 'Customer is a VIP — needs personal attention',
      createdById: sales.id,
      currentStageId: stages.SET.id,
      items: {
        create: [{
          description: 'Diamond tennis bracelet',
          size: '7 inches',
          qty: 1,
          stonesJson: JSON.stringify([
            { type: 'Diamond', shape: 'Round', size: '2mm', qty: 45, quality: 'VS2-G', source: 'in-house' },
          ]),
        }],
      },
    },
  });
  // Fast progression then stuck in setting
  const order4Stages: Array<[string, number, number | null, string, number, number | null]> = [
    ['BOOK',  20, 20, 'Sales',     0,    0],
    ['CAD',   20, 18, 'Design',    0,    0],
    ['RPT',   18, 17, 'Prototype', 0,    4.2],
    ['CAST',  17, 16, 'Casting',   4.2,  13.1],
    ['FILE',  16, 14, 'Filing',    13.1, 12.7],
    ['PREPOL',14, 13, 'Polishing', 12.7, 12.5],
  ];
  for (const [code, dIn, dOut, dept, wIn, wOut] of order4Stages) {
    await prisma.stageHistory.create({
      data: {
        orderId: order4.id,
        stageId: stages[code].id,
        karigarId: karBy(dept)?.id,
        inAt: addDays(today, -dIn),
        outAt: dOut ? addDays(today, -dOut) : null,
        wtIn: wIn || null,
        wtOut: wOut || null,
        wtLoss: (wIn && wOut) ? Number((wIn - wOut).toFixed(3)) : null,
        status: StageStatus.COMPLETED,
        recordedById: deptHead.id,
      },
    });
  }
  await prisma.stageHistory.create({
    data: {
      orderId: order4.id,
      stageId: stages.SET.id,
      karigarId: karBy('Setting')?.id,
      inAt: addDays(today, -13),
      wtIn: 12.5,
      status: StageStatus.IN_PROGRESS,
      notes: 'Waiting for additional matching stones',
      recordedById: deptHead.id,
    },
  });

  // --------------------------------------------------------------------------
  // 6. Sample audit log entries
  // --------------------------------------------------------------------------
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      entity: 'User',
      entityId: admin.id,
      action: 'CREATE',
      after: JSON.stringify({ name: admin.name, role: admin.role }),
    },
  });

  console.log('Seed complete.');
  console.log(`  Users: 4 (admin@mitva.local / admin123)`);
  console.log(`  Stages: ${stageData.length}`);
  console.log(`  Karigars: ${karigarData.length}`);
  console.log(`  Customers: ${customerData.length}`);
  console.log(`  Orders: 4 (1 active, 1 new, 1 dispatched, 1 overdue-VIP)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
