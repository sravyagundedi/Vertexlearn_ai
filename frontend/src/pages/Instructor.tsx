import { useEffect, useState } from 'react';
import { api } from '../services/api';
import {
  BarChart3,
  BookOpen,
  Plus,
  Users,
} from 'lucide-react';

type CourseAnalytics = {
  id: string;
  title: string;
  enrollments: number;
  avg_quiz_score: number;
};

type InstructorData = {
  courses: CourseAnalytics[];
};

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: any;
}) {
  return (
    <div className="stat-card">
      <div className="stat-icon">
        <Icon size={20} />
      </div>

      <div>
        <span className="stat-label">{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </div>
  );
}

export default function Instructor() {
  const [data, setData] = useState<InstructorData>({
    courses: [],
  });

  const [title, setTitle] = useState('');

  useEffect(() => {
    api.get('/instructor/analytics').then((r) => {
      setData(r.data);
    });
  }, []);

  async function create() {
    if (!title.trim()) {
      return;
    }

    await api.post('/courses', {
      title,
      description:
        'A practical VertexLearn course created from the instructor workspace.',
      category: 'Development',
      difficulty: 'intermediate',
      price: 0,
    });

    setTitle('');

    alert('Course submitted for admin approval');
  }

  const totalStudents = data.courses.reduce(
    (total: number, course: CourseAnalytics) =>
      total + Number(course.enrollments || 0),
    0
  );

  const averageQuizScore =
    data.courses.length > 0
      ? Math.round(
          data.courses.reduce(
            (total: number, course: CourseAnalytics) =>
              total + Number(course.avg_quiz_score || 0),
            0
          ) / data.courses.length
        )
      : null;

  return (
    <section>
      <header className="top">
        <div>
          <span className="eyebrow">
            INSTRUCTOR WORKSPACE
          </span>

          <h1>Teach with insight</h1>

          <p className="muted">
            Author courses and understand where learners
            need help.
          </p>
        </div>
      </header>

      <div className="stats">
        <StatCard
          label="My courses"
          value={data.courses.length}
          detail="Owned courses"
          icon={BookOpen}
        />

        <StatCard
          label="Students"
          value={totalStudents}
          detail="Across courses"
          icon={Users}
        />

        <StatCard
          label="Avg. quiz score"
          value={
            averageQuizScore !== null
              ? `${averageQuizScore}%`
              : '—'
          }
          detail="Objective quizzes"
          icon={BarChart3}
        />
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Create a course</h2>
          <span>P0 workflow</span>
        </div>

        <div className="inline-form">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Course title"
          />

          <button
            className="primary"
            onClick={create}
          >
            <Plus size={17} />
            Submit course
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Course analytics</h2>
        </div>

        {data.courses.map(
          (course: CourseAnalytics) => (
            <div
              className="table-row"
              key={course.id}
            >
              <b>{course.title}</b>

              <span>
                {course.enrollments} students
              </span>

              <span>
                {course.avg_quiz_score}% avg score
              </span>
            </div>
          )
        )}
      </div>
    </section>
  );
}