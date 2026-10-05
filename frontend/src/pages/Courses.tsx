import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Search,
  Star,
  ArrowRight,
  Filter,
  Check,
  PlayCircle,
  Clock,
  User,
  X,
  Compass,
} from 'lucide-react';
import { api, coursesApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { DifficultyBadge } from '../components/Badge';
import { CourseCardSkeleton } from '../components/Skeleton';

export default function Courses() {
  const [courses, setCourses] = useState<any[]>([]);
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [term, setTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('All');
  const [sortBy, setSortBy] = useState<string>('featured');
  const [enrollingId, setEnrollingId] = useState<string | null>(null);

  const { user } = useAuth();

  const fetchCoursesAndEnrollments = async () => {
    setLoading(true);
    try {
      const [coursesRes, enrollRes] = await Promise.all([
        coursesApi.getAll({ q: term || undefined }),
        user?.role === 'student' ? api.get('/enrollments/me').catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      ]);
      setCourses(coursesRes.data || []);
      const enrolledSet = new Set<string>((enrollRes.data || []).map((e: any) => e.course_id));
      setEnrolledIds(enrolledSet);
    } catch (err) {
      console.error('Error fetching courses catalog', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoursesAndEnrollments();
  }, [term]);

  const enroll = async (courseId: string) => {
    setEnrollingId(courseId);
    try {
      await coursesApi.enroll(courseId);
      setEnrolledIds((prev) => new Set([...prev, courseId]));
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Enrollment failed.');
    } finally {
      setEnrollingId(null);
    }
  };

  // Extract distinct categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    courses.forEach((c) => {
      if (c.category) set.add(c.category);
    });
    return ['All', ...Array.from(set)];
  }, [courses]);

  // Filter and sort courses locally
  const filteredCourses = useMemo(() => {
    return courses
      .filter((c) => {
        const matchesCat = selectedCategory === 'All' || c.category === selectedCategory;
        const matchesDiff = selectedDifficulty === 'All' || c.difficulty?.toLowerCase() === selectedDifficulty.toLowerCase();
        return matchesCat && matchesDiff;
      })
      .sort((a, b) => {
        if (sortBy === 'rating') return Number(b.rating || 0) - Number(a.rating || 0);
        if (sortBy === 'newest') return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        return 0; // Default order
      });
  }, [courses, selectedCategory, selectedDifficulty, sortBy]);

  return (
    <section>
      {/* Top Header */}
      <header className="top">
        <div>
          <span className="eyebrow">COURSE DISCOVERY</span>
          <h1>Explore the Catalog</h1>
          <p className="muted">
            Build practical, production-ready engineering skills with guided lessons and an AI Tutor.
          </p>
        </div>

        {/* Search Bar */}
        <div className="search">
          <Search size={18} color="#94a3b8" />
          <input
            placeholder="Search courses, skills, topics..."
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
          {term && (
            <button onClick={() => setTerm('')} style={{ color: '#94a3b8' }}>
              <X size={16} />
            </button>
          )}
        </div>
      </header>

      {/* Filter & Sort Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '14px',
          padding: '14px 20px',
          marginBottom: '28px',
        }}
      >
        {/* Category Pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Filter size={14} /> Category:
          </span>
          {categories.map((cat) => (
            <button
              key={cat}
              className={`prompt-chip ${selectedCategory === cat ? 'active' : ''}`}
              style={{
                backgroundColor: selectedCategory === cat ? '#0b2b67' : undefined,
                color: selectedCategory === cat ? '#ffffff' : undefined,
                borderColor: selectedCategory === cat ? '#0b2b67' : undefined,
              }}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Difficulty & Sort Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '12px',
              background: '#fff',
            }}
            aria-label="Filter by difficulty"
          >
            <option value="All">All Levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '12px',
              background: '#fff',
            }}
            aria-label="Sort courses"
          >
            <option value="featured">Featured</option>
            <option value="rating">Highest Rated</option>
            <option value="newest">Newest Additions</option>
          </select>
        </div>
      </div>

      {/* Courses Grid */}
      {loading ? (
        <div className="course-grid">
          <CourseCardSkeleton />
          <CourseCardSkeleton />
          <CourseCardSkeleton />
        </div>
      ) : filteredCourses.length > 0 ? (
        <div className="course-grid">
          {filteredCourses.map((c) => {
            const isEnrolled = enrolledIds.has(c.id);
            return (
              <article className="course-card" key={c.id}>
                <div className="course-cover">
                  <PlayCircle size={44} opacity={0.8} />
                  <span>{c.difficulty}</span>
                </div>
                <div className="course-body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span className="tag">{c.category || 'Engineering'}</span>
                    <DifficultyBadge difficulty={c.difficulty} />
                  </div>
                  <h3>{c.title}</h3>
                  <p>{c.description}</p>

                  <div className="course-meta">
                    <span>
                      <Star size={14} fill="currentColor" /> {c.rating || '4.8'}
                    </span>
                    <span>
                      <User size={13} style={{ marginRight: '4px' }} />
                      {c.instructor}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto' }}>
                    {user?.role === 'student' && (
                      isEnrolled ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            background: '#f0fdf4',
                            color: '#15803d',
                            border: '1px solid #bbf7d0',
                            borderRadius: '10px',
                            padding: '10px',
                            fontSize: '13px',
                            fontWeight: 700,
                          }}
                        >
                          <Check size={16} /> Enrolled
                        </span>
                      ) : (
                        <button
                          className="btn btn-primary full"
                          onClick={() => enroll(c.id)}
                          disabled={enrollingId === c.id}
                        >
                          {enrollingId === c.id ? 'Enrolling...' : 'Enroll Free'}
                        </button>
                      )
                    )}

                    <Link className="btn btn-secondary full" to={`/courses/${c.id}`}>
                      {isEnrolled ? 'Open Course Player' : 'View Curriculum'} <ArrowRight size={15} />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty" style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '60px 20px' }}>
          <Compass size={40} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
          <h3>No matching courses found</h3>
          <p style={{ color: '#64748b', fontSize: '13px', margin: '6px 0 16px' }}>
            Try adjusting your search keywords or resetting your category/difficulty filters.
          </p>
          <button
            className="btn btn-outline"
            onClick={() => {
              setTerm('');
              setSelectedCategory('All');
              setSelectedDifficulty('All');
            }}
          >
            Reset All Filters
          </button>
        </div>
      )}
    </section>
  );
}
