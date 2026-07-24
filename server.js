require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static frontend files from current directory
app.use(express.static(path.join(__dirname)));

// Database connection
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("FATAL ERROR: DATABASE_URL is not set in environment variables!");
  process.exit(1);
}
const pool = new Pool({ connectionString });

// Serve the master roadmap database file dynamically from PostgreSQL
app.get('/de_master_roadmap_database.json', async (req, res) => {
  try {
    // 1. Fetch Calendar
    const calendarRes = await pool.query('SELECT * FROM curriculum_calendar ORDER BY day_number ASC');
    
    // 2. Fetch Questions
    const questionsRes = await pool.query('SELECT * FROM curriculum_questions ORDER BY id ASC');
    
    // 3. Fetch Projects
    const projectsRes = await pool.query('SELECT * FROM curriculum_projects');
    
    // 4. Fetch Milestones
    const milestonesRes = await pool.query('SELECT * FROM curriculum_milestones');
    
    // 5. Fetch Cheat Sheets
    const sheetsRes = await pool.query('SELECT * FROM curriculum_cheat_sheets');
    
    // 6. Fetch Target Companies
    const companiesRes = await pool.query('SELECT * FROM curriculum_target_companies');

    // Group questions by category
    const sql_question_bank = [];
    const dsa_problems = [];
    const pyspark_questions = [];
    const de_concepts = [];
    const interview_prep = [];

    questionsRes.rows.forEach(q => {
      const formatted = {
        id: q.id,
        title: q.title,
        question: q.question,
        difficulty: q.difficulty,
        topic: q.topic,
        leetcode_link: q.leetcode_link,
        answer_key_points: q.answer_key_points,
        preparation_tips: q.preparation_tips
      };
      
      if (q.category === 'sql') sql_question_bank.push(formatted);
      else if (q.category === 'dsa') dsa_problems.push(formatted);
      else if (q.category === 'pyspark') pyspark_questions.push(formatted);
      else if (q.category === 'concepts') de_concepts.push(formatted);
      else if (q.category === 'interview') interview_prep.push(formatted);
    });

    // Format projects
    const projects = projectsRes.rows.map(p => ({
      name: p.name,
      week: p.week,
      month: p.month,
      type: p.type,
      focus: p.focus,
      technologies: p.technologies || '',
      key_skills: p.key_skills,
      deliverables: p.deliverables || '',
      due_by: p.due_by
    }));

    // Format milestones
    const milestones = milestonesRes.rows.map(m => ({
      name: m.name,
      type: m.type,
      award_rs: m.award_rs,
      award_xp: m.award_xp
    }));

    // Format cheat sheets
    const cheat_sheets = {};
    sheetsRes.rows.forEach(s => {
      cheat_sheets[s.sheet_key] = {
        content: s.content,
        last_updated: null
      };
    });

    // Format target companies
    const target_companies = companiesRes.rows.map(c => ({ name: c.name }));

    // Construct the metadata
    const meta = {
      title: "DE Mastery curriculum database",
      version: "3.0.0",
      description: "Data Engineering entry-level roadmap curriculum fetched from Neon PostgreSQL"
    };

    // Reconstruct the exact database JSON structure
    const curriculumData = {
      meta,
      user_profile: {}, 
      calendar: calendarRes.rows,
      sql_question_bank,
      dsa_problems,
      pyspark_questions,
      de_concepts,
      projects,
      interview_prep,
      milestones,
      cheat_sheets,
      target_companies
    };

    res.json(curriculumData);
  } catch (err) {
    console.error("Error fetching curriculum from database:", err);
    res.status(500).json({ error: "Failed to load curriculum from database" });
  }
});

// ================= AUTH ENDPOINTS =================

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, pin } = req.body;

  if (pin !== '6565') {
    return res.status(401).json({ error: 'Invalid login PIN! Hint: Use 6565' });
  }

  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No account found with this email. Please Sign Up first!' });
    }

    const user = result.rows[0];
    res.json({ message: 'Login successful', user });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server database error during login' });
  }
});

// Signup
app.post('/api/auth/signup', async (req, res) => {
  const { name, email, goal, daily_study_hours, target_companies, pin } = req.body;

  if (pin !== '6565') {
    return res.status(401).json({ error: 'Invalid PIN for signup! Hint: Use 6565' });
  }

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }
  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    // Check if email already exists
    const checkEmail = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    if (checkEmail.rows.length > 0) {
      return res.status(400).json({ error: 'An account with this email already exists! Please log in instead.' });
    }

    // Insert user
    const insertUser = await pool.query(
      `INSERT INTO users (name, email, goal, daily_study_hours, target_companies, balance, xp, level)
       VALUES ($1, $2, $3, $4, $5, 0, 0, 1) RETURNING *`,
      [
        name.trim(),
        email.trim(),
        goal ? goal.trim() : '',
        daily_study_hours || 5,
        target_companies || []
      ]
    );

    const newUser = insertUser.rows[0];
    res.status(201).json({ message: 'Signup successful', user: newUser });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Server database error during signup' });
  }
});

// ================= PROGRESS FETCH ENDPOINT =================

app.get('/api/user/:userId/data', async (req, res) => {
  const userId = parseInt(req.params.userId);

  try {
    // Fetch profile
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const profile = userResult.rows[0];

    // Fetch progress relations
    const calendarResult = await pool.query('SELECT * FROM user_calendar_progress WHERE user_id = $1', [userId]);
    const questionsResult = await pool.query('SELECT * FROM user_question_progress WHERE user_id = $1', [userId]);
    const projectsResult = await pool.query('SELECT * FROM user_projects_progress WHERE user_id = $1', [userId]);
    const milestonesResult = await pool.query('SELECT * FROM user_milestones_progress WHERE user_id = $1', [userId]);
    const sheetsResult = await pool.query('SELECT * FROM user_cheat_sheets WHERE user_id = $1', [userId]);
    const companiesResult = await pool.query('SELECT * FROM user_target_companies WHERE user_id = $1', [userId]);

    res.json({
      profile,
      calendar: calendarResult.rows,
      questions: questionsResult.rows,
      projects: projectsResult.rows,
      milestones: milestonesResult.rows,
      cheat_sheets: sheetsResult.rows,
      target_companies: companiesResult.rows
    });
  } catch (err) {
    console.error('Fetch progress error:', err);
    res.status(500).json({ error: 'Failed to fetch user data from database' });
  }
});

// ================= PROGRESS SAVE ENDPOINTS =================

// Save Profile State
app.post('/api/user/:userId/update-profile', async (req, res) => {
  const userId = parseInt(req.params.userId);
  const {
    balance,
    current_streak,
    best_streak,
    xp,
    level,
    streak_freezes_owned,
    double_xp_active_count,
    avatar_golden_owl,
    theme_matrix_editor,
    ai_coach_calls,
    gemini_api_key,
    last_checkin_date,
    last_quest_date,
    simulated_date,
    claimed_checkin_dates,
    daily_quests,
    daily_study_hours,
    goal,
    target_companies
  } = req.body;

  try {
    await pool.query(
      `UPDATE users 
       SET balance = $1, current_streak = $2, best_streak = $3, xp = $4, level = $5,
           streak_freezes_owned = $6, double_xp_active_count = $7, avatar_golden_owl = $8,
           theme_matrix_editor = $9, ai_coach_calls = $10, gemini_api_key = $11,
           last_checkin_date = $12, last_quest_date = $13, simulated_date = $14,
           claimed_checkin_dates = $15, daily_quests = $16, daily_study_hours = $17,
           goal = $18, target_companies = $19, updated_at = CURRENT_TIMESTAMP
       WHERE id = $20`,
      [
        balance || 0,
        current_streak || 0,
        best_streak || 0,
        xp || 0,
        level || 1,
        streak_freezes_owned || 0,
        double_xp_active_count || 0,
        avatar_golden_owl || false,
        theme_matrix_editor || false,
        ai_coach_calls || 0,
        gemini_api_key || '',
        last_checkin_date || null,
        last_quest_date || null,
        simulated_date || null,
        claimed_checkin_dates || [],
        JSON.stringify(daily_quests || []),
        daily_study_hours || 5,
        goal || '',
        target_companies || [],
        userId
      ]
    );
    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Database update failed' });
  }
});

// Save Calendar Day Progress
app.post('/api/user/:userId/update-calendar-day', async (req, res) => {
  const userId = parseInt(req.params.userId);
  const {
    day_number,
    morning_completed,
    afternoon_completed,
    evening_completed,
    completed,
    penalized,
    notes,
    time_spent_minutes,
    rating
  } = req.body;

  try {
    await pool.query(
      `INSERT INTO user_calendar_progress (
         user_id, day_number, morning_completed, afternoon_completed, evening_completed,
         completed, penalized, notes, time_spent_minutes, rating
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (user_id, day_number) DO UPDATE SET
         morning_completed = EXCLUDED.morning_completed,
         afternoon_completed = EXCLUDED.afternoon_completed,
         evening_completed = EXCLUDED.evening_completed,
         completed = EXCLUDED.completed,
         penalized = EXCLUDED.penalized,
         notes = EXCLUDED.notes,
         time_spent_minutes = EXCLUDED.time_spent_minutes,
         rating = EXCLUDED.rating`,
      [
        userId,
        day_number,
        morning_completed || false,
        afternoon_completed || false,
        evening_completed || false,
        completed || false,
        penalized || false,
        notes || '',
        time_spent_minutes || 0,
        rating || null
      ]
    );
    res.json({ success: true, message: `Day ${day_number} updated` });
  } catch (err) {
    console.error('Update calendar progress error:', err);
    res.status(500).json({ error: 'Database update failed' });
  }
});

// Save Question Progress
app.post('/api/user/:userId/update-question', async (req, res) => {
  const userId = parseInt(req.params.userId);
  const {
    category,
    item_id,
    solved,
    second_solved,
    third_solved,
    date_solved,
    date_second_solved,
    date_third_solved,
    notes,
    solution_code,
    confidence_level,
    attempts,
    detailed_description,
    ai_schema_context,
    ai_code_review_hint,
    ai_chat_history
  } = req.body;

  try {
    await pool.query(
      `INSERT INTO user_question_progress (
         user_id, category, item_id, solved, second_solved, third_solved,
         date_solved, date_second_solved, date_third_solved, notes, solution_code,
         confidence_level, attempts, detailed_description, ai_schema_context,
         ai_code_review_hint, ai_chat_history
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       ON CONFLICT (user_id, category, item_id) DO UPDATE SET
         solved = EXCLUDED.solved,
         second_solved = EXCLUDED.second_solved,
         third_solved = EXCLUDED.third_solved,
         date_solved = EXCLUDED.date_solved,
         date_second_solved = EXCLUDED.date_second_solved,
         date_third_solved = EXCLUDED.date_third_solved,
         notes = EXCLUDED.notes,
         solution_code = EXCLUDED.solution_code,
         confidence_level = EXCLUDED.confidence_level,
         attempts = EXCLUDED.attempts,
         detailed_description = EXCLUDED.detailed_description,
         ai_schema_context = EXCLUDED.ai_schema_context,
         ai_code_review_hint = EXCLUDED.ai_code_review_hint,
         ai_chat_history = EXCLUDED.ai_chat_history`,
      [
        userId,
        category,
        item_id,
        solved || false,
        second_solved || false,
        third_solved || false,
        date_solved || null,
        date_second_solved || null,
        date_third_solved || null,
        notes || '',
        solution_code || '',
        confidence_level || 0,
        attempts || 0,
        detailed_description || null,
        ai_schema_context || null,
        ai_code_review_hint || null,
        JSON.stringify(ai_chat_history || [])
      ]
    );
    res.json({ success: true, message: `Question ${category} #${item_id} updated` });
  } catch (err) {
    console.error('Update question progress error:', err);
    res.status(500).json({ error: 'Database update failed' });
  }
});

// Save Project Progress
app.post('/api/user/:userId/update-project', async (req, res) => {
  const userId = parseInt(req.params.userId);
  const {
    project_name,
    project_week,
    completed,
    github_url,
    notes,
    rating,
    time_spent_hours
  } = req.body;

  try {
    await pool.query(
      `INSERT INTO user_projects_progress (
         user_id, project_name, project_week, completed, github_url, notes, rating, time_spent_hours
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id, project_name, project_week) DO UPDATE SET
         completed = EXCLUDED.completed,
         github_url = EXCLUDED.github_url,
         notes = EXCLUDED.notes,
         rating = EXCLUDED.rating,
         time_spent_hours = EXCLUDED.time_spent_hours`,
      [
        userId,
        project_name,
        project_week,
        completed || false,
        github_url || '',
        notes || '',
        rating || null,
        time_spent_hours || 0
      ]
    );
    res.json({ success: true, message: `Project ${project_name} updated` });
  } catch (err) {
    console.error('Update project progress error:', err);
    res.status(500).json({ error: 'Database update failed' });
  }
});

// Save Milestone Progress
app.post('/api/user/:userId/update-milestone', async (req, res) => {
  const userId = parseInt(req.params.userId);
  const { milestone_name, completed } = req.body;

  try {
    await pool.query(
      `INSERT INTO user_milestones_progress (user_id, milestone_name, completed)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, milestone_name) DO UPDATE SET
         completed = EXCLUDED.completed`,
      [userId, milestone_name, completed || false]
    );
    res.json({ success: true, message: `Milestone ${milestone_name} updated` });
  } catch (err) {
    console.error('Update milestone progress error:', err);
    res.status(500).json({ error: 'Database update failed' });
  }
});

// Save Cheat Sheet Content
app.post('/api/user/:userId/update-cheatsheet', async (req, res) => {
  const userId = parseInt(req.params.userId);
  const { sheet_key, content } = req.body;

  try {
    await pool.query(
      `INSERT INTO user_cheat_sheets (user_id, sheet_key, content)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, sheet_key) DO UPDATE SET
         content = EXCLUDED.content`,
      [userId, sheet_key, content || '']
    );
    res.json({ success: true, message: `Cheat sheet ${sheet_key} updated` });
  } catch (err) {
    console.error('Update cheat sheet error:', err);
    res.status(500).json({ error: 'Database update failed' });
  }
});

// Save Target Company Progress
app.post('/api/user/:userId/update-company', async (req, res) => {
  const userId = parseInt(req.params.userId);
  const {
    company_name,
    researched,
    sql_practiced,
    dsa_reviewed,
    notes
  } = req.body;

  try {
    await pool.query(
      `INSERT INTO user_target_companies (
         user_id, company_name, researched, sql_practiced, dsa_reviewed, notes
       ) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, company_name) DO UPDATE SET
         researched = EXCLUDED.researched,
         sql_practiced = EXCLUDED.sql_practiced,
         dsa_reviewed = EXCLUDED.dsa_reviewed,
         notes = EXCLUDED.notes`,
      [
        userId,
        company_name,
        researched || false,
        sql_practiced || false,
        dsa_reviewed || false,
        notes || ''
      ]
    );
    res.json({ success: true, message: `Company ${company_name} updated` });
  } catch (err) {
    console.error('Update target company progress error:', err);
    res.status(500).json({ error: 'Database update failed' });
  }
});

// Reset User Progress API
app.post('/api/user/:userId/reset', async (req, res) => {
  const userId = parseInt(req.params.userId);
  try {
    await pool.query('DELETE FROM user_calendar_progress WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM user_question_progress WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM user_projects_progress WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM user_milestones_progress WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM user_cheat_sheets WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM user_target_companies WHERE user_id = $1', [userId]);
    
    // Reset user profile values
    await pool.query(
      `UPDATE users 
       SET balance = 0, current_streak = 0, best_streak = 0, xp = 0, level = 1,
           streak_freezes_owned = 0, double_xp_active_count = 0, avatar_golden_owl = false,
           theme_matrix_editor = false, ai_coach_calls = 0, last_checkin_date = null,
           last_quest_date = null, claimed_checkin_dates = '{}', daily_quests = '[]'::jsonb,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [userId]
    );
    res.json({ success: true, message: 'User progress reset successfully in PostgreSQL' });
  } catch (err) {
    console.error('Reset database progress error:', err);
    res.status(500).json({ error: 'Failed to reset user progress in database' });
  }
});

// ================= ADMIN ENDPOINTS =================

// Get all users with aggregated completion statistics
app.get('/api/admin/users', async (req, res) => {
  try {
    const query = `
      SELECT u.id, u.name, u.email, u.goal, u.daily_study_hours, u.balance, u.current_streak, u.best_streak, u.xp, u.level, u.created_at,
             (SELECT COUNT(*) FROM user_calendar_progress WHERE user_id = u.id AND completed = true) as calendar_completed,
             (SELECT COUNT(*) FROM user_question_progress WHERE user_id = u.id AND solved = true) as questions_solved,
             (SELECT COUNT(*) FROM user_projects_progress WHERE user_id = u.id AND completed = true) as projects_completed
      FROM users u
      ORDER BY u.created_at DESC;
    `;
    const result = await pool.query(query);
    res.json({ users: result.rows });
  } catch (err) {
    console.error("Admin: failed to fetch users list:", err);
    res.status(500).json({ error: "Failed to fetch users list for admin dashboard" });
  }
});

// Delete user account completely
app.delete('/api/admin/user/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId);
  try {
    await pool.query('BEGIN');
    await pool.query('DELETE FROM user_calendar_progress WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM user_question_progress WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM user_projects_progress WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM user_milestones_progress WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM user_cheat_sheets WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM user_target_companies WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    await pool.query('COMMIT');
    res.json({ success: true, message: 'User account and all progress successfully deleted' });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error("Admin: failed to delete user:", err);
    res.status(500).json({ error: "Failed to delete user account" });
  }
});

// Route for admin dashboard HTML
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Catch-all middleware to serve the main HTML page
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server locally (skip listen when deploying as a Vercel Serverless Function)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

// Export Express app for Vercel Serverless Function environment
module.exports = app;
