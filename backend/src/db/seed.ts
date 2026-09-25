import bcrypt from 'bcryptjs';import {q,pool} from './pool.js';
async function seed(){
 const pass=await bcrypt.hash('Password123!',12);
 const users=[['Demo Student','student@vertexlearn.local','student'],['Demo Instructor','instructor@vertexlearn.local','instructor'],['Demo Admin','admin@vertexlearn.local','admin']];
 for(const [n,e,r] of users) await q(`INSERT INTO users(full_name,email,password_hash,role) VALUES($1,$2,$3,$4) ON CONFLICT(email) DO NOTHING`,[n,e,pass,r]);
 const instructor=(await q<any>('SELECT id FROM users WHERE email=$1',['instructor@vertexlearn.local']))[0].id;
 const c=await q<any>(`INSERT INTO courses(instructor_id,title,description,category,difficulty,status) VALUES($1,$2,$3,$4,$5,'approved') ON CONFLICT DO NOTHING RETURNING id`,[instructor,'Full Stack Web Development','Build modern web applications with frontend, APIs, databases and deployment.','Development','intermediate']);
 let cid=c[0]?.id;if(!cid) cid=(await q<any>('SELECT id FROM courses WHERE title=$1',['Full Stack Web Development']))[0].id;
 let m=await q<any>('SELECT id FROM modules WHERE course_id=$1 LIMIT 1',[cid]);let mid=m[0]?.id;if(!mid){mid=(await q<any>('INSERT INTO modules(course_id,title,order_index) VALUES($1,$2,1) RETURNING id',[cid,'Modern Web Foundations']))[0].id;}
 let l=await q<any>('SELECT id FROM lectures WHERE module_id=$1 LIMIT 1',[mid]);if(!l[0]) await q('INSERT INTO lectures(module_id,title,transcript,duration_seconds,order_index) VALUES($1,$2,$3,$4,1)',[mid,'REST APIs and HTTP','REST APIs expose resources over HTTP. GET reads data, POST creates resources, PUT updates resources, and DELETE removes resources. Authentication and authorization protect private endpoints. Good APIs validate inputs, return predictable errors, and use pagination for large collections.',600]);
 const student=(await q<any>('SELECT id FROM users WHERE email=$1',['student@vertexlearn.local']))[0].id;await q('INSERT INTO enrollments(user_id,course_id,progress_percent) VALUES($1,$2,35) ON CONFLICT(user_id,course_id) DO NOTHING',[student,cid]);
 console.log('Seed complete');await pool.end();
}seed().catch(e=>{console.error(e);process.exit(1)});
