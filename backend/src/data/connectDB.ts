import { Sequelize } from 'sequelize'
import { env } from '../config/env'

export const sequelize = new Sequelize({
  database: env.PG_DATABASE,
  username: env.PG_USER,
  password: env.PG_PASSWORD,
  host: env.PG_HOST,
  port: Number(env.PG_PORT) || 5432,
  dialect: 'postgres',
  logging: false,
})

export async function connectDB() {
  try {
    await sequelize.authenticate()
    console.log('✅ PostgreSQL connected successfully!')
  } catch (error) {
    console.error('❌ Unable to connect to PostgreSQL:', error)
    process.exit(1)
  }
}
