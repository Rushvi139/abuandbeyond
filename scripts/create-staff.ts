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
  const name = arg("name"), phoneRaw = arg("phone"), email = arg("email")?.toLowerCase(), password = arg("password");
  const username = arg("username")?.trim().toLowerCase();
  const role = arg("role") ?? "kitchen";
  if (!name || (!phoneRaw && !email && !username) || !password) {
    throw new Error("need --name, one of --username/--phone/--email, --password [--role owner|manager|kitchen|rider]");
  }
  if (username && !/^[a-z0-9._-]{3,30}$/.test(username)) throw new Error("username: 3-30 chars, letters/numbers/._- only");
  if (!["owner", "manager", "kitchen", "rider"].includes(role)) throw new Error("bad role");
  if (password.length < 8) throw new Error("password must be at least 8 characters");
  const phone = phoneRaw ? "+91" + phoneRaw.replace(/\D/g, "").slice(-10) : null;
  const hash = await bcrypt.hash(password, 11);
  // update by whichever identifier already exists, else insert
  const [existing] = await sql<{ id: string }[]>`
    select id from staff_users
    where (${username ?? null}::text is not null and lower(username) = ${username ?? null})
       or (${phone}::text is not null and phone = ${phone})
       or (${email ?? null}::text is not null and lower(email) = ${email ?? null})
    limit 1`;
  const [row] = existing
    ? await sql<{ id: string }[]>`update staff_users set full_name = ${name}, password_hash = ${hash}, role = ${role}, active = true,
        username = coalesce(${username ?? null}, username), phone = coalesce(${phone}, phone), email = coalesce(${email ?? null}, email)
        where id = ${existing.id} returning id`
    : await sql<{ id: string }[]>`insert into staff_users (full_name, username, phone, email, password_hash, role)
        values (${name}, ${username ?? null}, ${phone}, ${email ?? null}, ${hash}, ${role}) returning id`;
  console.log(`staff ${name} (${role}) signs in as "${username ?? phone ?? email}" — ${row.id}`);
}

main()
  .catch((e) => { console.error(e.message); process.exitCode = 1; })
  .finally(() => sql.end());
