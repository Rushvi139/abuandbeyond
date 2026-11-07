// Create or update a staff login.
// Usage: npm run staff -- --name "Rushvi" --phone 98xxxxxxxx --role owner --password 'secret'
//   or on the server: docker compose run --rm migrate npm run staff -- --name ... --phone ... --role owner --password ...
import bcrypt from "bcryptjs";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const sql = postgres(url, { max: 1, onnotice: () => {} });

function arg(name: string) {
  const i = process.argv.indexOf("--" + name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const name = arg("name"), phoneRaw = arg("phone"), email = arg("email")?.toLowerCase(), role = arg("role") ?? "kitchen", password = arg("password");
  if (!name || (!phoneRaw && !email) || !password) throw new Error("need --name, --phone or --email, --password [--role owner|manager|kitchen|rider]");
  if (!["owner", "manager", "kitchen", "rider"].includes(role)) throw new Error("bad role");
  if (password.length < 8) throw new Error("password must be at least 8 characters");
  const phone = phoneRaw ? "+91" + phoneRaw.replace(/\D/g, "").slice(-10) : null;
  const hash = await bcrypt.hash(password, 11);
  const [row] = await sql<{ id: string }[]>`insert into staff_users (full_name, phone, email, password_hash, role)
    values (${name}, ${phone}, ${email ?? null}, ${hash}, ${role})
    on conflict (phone) do update set full_name = excluded.full_name, password_hash = excluded.password_hash, role = excluded.role, active = true
    returning id`;
  console.log(`staff ${name} (${role}) ready: ${row.id}`);
}

main()
  .catch((e) => { console.error(e.message); process.exitCode = 1; })
  .finally(() => sql.end());
