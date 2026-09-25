import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
export const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});
export async function q<T=any>(text:string, params:any[]=[]){const r=await pool.query(text,params);return r.rows as T[];}
