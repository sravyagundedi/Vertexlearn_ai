import {useEffect,useState} from 'react';
import {useParams} from 'react-router-dom';
import {api} from '../services/api';
import {BookOpen,CheckCircle2,MessageSquare,Send,Sparkles} from 'lucide-react';
export default function CourseDetails(){
    const {id}=useParams();
const [course,setCourse]=useState<any>(null);
const [question,setQuestion]=useState('');
const [reply,setReply]=useState('');
const [sources,setSources]=useState<any[]>([]);
const [mode,setMode]=useState('intermediate');
useEffect(()=>{
    api.get(`/courses/${id}`).then(r=>setCourse(r.data));
},[id]);
async function ask(){
    if(!question.trim())return;
    const r=await api.post('/ai/chat',{
        course_id:id,
        question,
        mode
    });
    setReply(r.data.reply);setSources(r.data.sources||[]);
    setQuestion('')
}
if(!course){
return <div className="loading">Loading course…</div>;
}
return <section>
    <header className="top">
    <div> <span className="eyebrow">COURSE PLAYER</span>
            <h1>{course.title}</h1>
            <p className="muted">{course.description}</p></div></header>
    <div className="course-layout">
    <div className="panel">
    <div className="panel-head">
    <h2><BookOpen size={18}/>Curriculum</h2>
    <span>{course.modules?.length||0} modules</span></div>
          {course.modules?.map((m:any)=>
    <div key={m.id} className="module">
    <b>{m.title}</b>
       {m.lectures?.map((l:any)=>
    <div className="lecture" key={l.id}>
    <CheckCircle2 size={17}/>
    <span>{l.title}</span>
    <small>{Math.round((l.duration_seconds||0)/60)} min</small></div>)}</div>)}</div>
    <div className="panel tutor">
    <div className="panel-head">
    <div><span className="eyebrow">AI TUTOR</span>
        <h2><Sparkles size={18}/> Ask about this course</h2></div>
        <select value={mode} onChange={e=>setMode(e.target.value)}>
        <option>beginner</option>
        <option>intermediate</option>
        <option>advanced</option></select></div>
    <div className="chat-box">
  {reply ? (
    <>
      <div className="user-msg">
        Your question was sent.
      </div>

      <div className="ai-msg">
        {reply}
      </div>

      {sources.length > 0 && (
        <div className="sources">
          <b>Sources</b>

          {sources.map((s, i) => (
            <span key={i}>
              Lecture {s.lecture_id.slice(0, 8)}…
            </span>
          ))}
        </div>
      )}
    </>
  ) : (
    <div className="chat-empty">
      <MessageSquare size={30} />

      <b>Course-grounded help</b>

      <span>
        Ask a question and VertexLearn AI will retrieve relevant course
        material before answering.
      </span>
    </div>
  )}
</div>
    <div className="ask">
    <input value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>e.key==='Enter'&&ask()} placeholder="e.g. Explain REST APIs simply"/>
    <button className="primary" onClick={ask}>
    <Send size={16}/></button></div></div></div></section>}
