import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

const DEMO_PASSWORD = "Zeitspiel1!";

const employees = [
  { name: "Marvin",    email: "marvin@firma.de",    role: "EMPLOYEE"   },
  { name: "Billy",     email: "billy@firma.de",      role: "EMPLOYEE"   },
  { name: "Tristan",   email: "tristan@firma.de",    role: "EMPLOYEE"   },
  { name: "Daniel",    email: "daniel@firma.de",     role: "EMPLOYEE"   },
  { name: "Sebastian", email: "sebastian@firma.de",  role: "EMPLOYEE"   },
  { name: "Georg",     email: "georg@firma.de",      role: "EMPLOYEE"   },
  { name: "System",    email: "system@firma.de",     role: "SUPERADMIN" },
];

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const model = await db.workingTimeModel.findFirst({
    where: { name: "Standard 40h" },
  });
  if (!model) throw new Error("WorkingTimeModel 'Standard 40h' nicht gefunden — seed zuerst ausführen");

  let employeeNum = 1001;

  for (const emp of employees) {
    const role = await db.role.findUnique({ where: { name: emp.role } });
    if (!role) throw new Error(`Rolle ${emp.role} nicht gefunden`);

    const user = await db.user.upsert({
      where: { email: emp.email },
      update: {},
      create: {
        email: emp.email,
        name: emp.name,
        passwordHash,
        mustChangePassword: false,
        employeeNumber: String(employeeNum),
        contractType: "FULLTIME",
        workingTimeModelId: model.id,
      },
    });

    await db.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });

    await db.workingTimeConfig.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        hoursPerDay: 8.0,
        hoursPerWeek: 40.0,
        vacationDays: 28,
        breakMinutes: 30,
      },
    });

    console.log(`✅ ${emp.name.padEnd(12)} ${emp.email.padEnd(25)} [${emp.role}]`);
    employeeNum++;
  }

  console.log(`\nPasswort für alle: ${DEMO_PASSWORD}`);
  console.log("System-Konto (SUPERADMIN): system@firma.de");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
