// Load the bot's .env before the shared Prisma client is constructed.
import "./config/env.js";
import { prisma } from "@holdmetoit/database";

export { prisma };
export default prisma;
