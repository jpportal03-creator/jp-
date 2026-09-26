import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_PLANS = [
  { code: 'monthly', name: 'Monthly', description: 'Premium access billed every month.', durationDays: 30, priceInPaise: 9900, interval: 'month' },
  { code: 'quarterly', name: '3 Months', description: 'Premium access for three months.', durationDays: 90, priceInPaise: 19900, interval: 'quarter' },
  { code: 'yearly', name: 'Yearly', description: 'Premium access for one year.', durationDays: 365, priceInPaise: 49900, interval: 'year' },
];

const DEFAULT_COLLEGE = {
  name: 'JP Institute of Technology',
  domains: ['mail.jiit.ac.in'],
  courses: ['Computer Science & Engineering', 'Information Technology', 'Business Administration', 'Electronics & Communication', 'Mechanical Engineering'],
  semesters: ['Semester 1', 'Semester 2', 'Semester 3', 'Semester 4', 'Semester 5', 'Semester 6', 'Semester 7', 'Semester 8'],
};

async function main() {
  console.log('Seeding database...');

  // 1. Seed Subscription Plans
  for (const plan of DEFAULT_PLANS) {
    await prisma.subscriptionPlan.upsert({
      where: { code: plan.code },
      update: {},
      create: plan,
    });
  }
  console.log(`✓ Subscription plans seeded (${DEFAULT_PLANS.length} plans)`);

  // 2. Seed Default College
  let college = await prisma.college.findFirst({
    where: { name: DEFAULT_COLLEGE.name },
  });

  if (!college) {
    college = await prisma.college.create({
      data: {
        name: DEFAULT_COLLEGE.name,
        active: true,
      },
    });
  }
  console.log(`✓ College "${college.name}" ensured (${college.id})`);

  // 3. Seed College Domains
  await prisma.collegeDomain.updateMany({
    where: {
      collegeId: college.id,
      domain: { notIn: DEFAULT_COLLEGE.domains },
    },
    data: { active: false },
  });

  for (const domain of DEFAULT_COLLEGE.domains) {
    await prisma.collegeDomain.upsert({
      where: { domain },
      update: { active: true },
      create: {
        collegeId: college.id,
        domain,
        active: true,
      },
    });
  }
  console.log(`✓ College domains seeded: ${DEFAULT_COLLEGE.domains.join(', ')}`);

  // 4. Seed Courses
  for (const courseName of DEFAULT_COLLEGE.courses) {
    const existing = await prisma.course.findFirst({
      where: { name: courseName, collegeId: college.id },
    });
    if (!existing) {
      await prisma.course.create({
        data: {
          name: courseName,
          collegeId: college.id,
          active: true,
        },
      });
    }
  }
  console.log(`✓ Courses seeded (${DEFAULT_COLLEGE.courses.length} courses)`);

  // 5. Seed Semesters
  for (const semesterName of DEFAULT_COLLEGE.semesters) {
    const existing = await prisma.semester.findFirst({
      where: { name: semesterName, collegeId: college.id },
    });
    if (!existing) {
      await prisma.semester.create({
        data: {
          name: semesterName,
          collegeId: college.id,
          active: true,
        },
      });
    }
  }
  console.log(`✓ Semesters seeded (${DEFAULT_COLLEGE.semesters.length} semesters)`);

  console.log('Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during database seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
