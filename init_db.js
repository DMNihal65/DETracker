require('dotenv').config();
const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("FATAL ERROR: DATABASE_URL is not set in environment variables!");
  process.exit(1);
}

async function main() {
  const client = new Client({
    connectionString: connectionString,
  });

  try {
    console.log("Connecting to Neon PostgreSQL...");
    await client.connect();
    console.log("Connected successfully!");

    console.log("Creating tables...");

    // 1. Users Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        goal VARCHAR(255) DEFAULT '',
        daily_study_hours INT DEFAULT 5,
        target_companies TEXT[] DEFAULT '{}',
        balance INT DEFAULT 0,
        current_streak INT DEFAULT 0,
        best_streak INT DEFAULT 0,
        xp INT DEFAULT 0,
        level INT DEFAULT 1,
        streak_freezes_owned INT DEFAULT 0,
        double_xp_active_count INT DEFAULT 0,
        avatar_golden_owl BOOLEAN DEFAULT FALSE,
        theme_matrix_editor BOOLEAN DEFAULT FALSE,
        ai_coach_calls INT DEFAULT 0,
        gemini_api_key TEXT DEFAULT '',
        last_checkin_date VARCHAR(10) DEFAULT NULL,
        last_quest_date VARCHAR(10) DEFAULT NULL,
        simulated_date VARCHAR(10) DEFAULT NULL,
        claimed_checkin_dates TEXT[] DEFAULT '{}',
        daily_quests JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("- Created 'users' table");

    // 2. Calendar Progress Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_calendar_progress (
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        day_number INT NOT NULL,
        morning_completed BOOLEAN DEFAULT FALSE,
        afternoon_completed BOOLEAN DEFAULT FALSE,
        evening_completed BOOLEAN DEFAULT FALSE,
        completed BOOLEAN DEFAULT FALSE,
        penalized BOOLEAN DEFAULT FALSE,
        notes TEXT DEFAULT '',
        time_spent_minutes INT DEFAULT 0,
        rating INT DEFAULT NULL,
        PRIMARY KEY (user_id, day_number)
      );
    `);
    console.log("- Created 'user_calendar_progress' table");

    // 3. Question Progress Table (handles SQL, DSA, PySpark, Concepts, Interview Prep)
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_question_progress (
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        category VARCHAR(30) NOT NULL,
        item_id INT NOT NULL,
        solved BOOLEAN DEFAULT FALSE,
        second_solved BOOLEAN DEFAULT FALSE,
        third_solved BOOLEAN DEFAULT FALSE,
        date_solved VARCHAR(10) DEFAULT NULL,
        date_second_solved VARCHAR(10) DEFAULT NULL,
        date_third_solved VARCHAR(10) DEFAULT NULL,
        notes TEXT DEFAULT '',
        solution_code TEXT DEFAULT '',
        confidence_level INT DEFAULT 0,
        attempts INT DEFAULT 0,
        detailed_description TEXT DEFAULT NULL,
        ai_schema_context TEXT DEFAULT NULL,
        ai_code_review_hint TEXT DEFAULT NULL,
        ai_chat_history JSONB DEFAULT '[]'::jsonb,
        PRIMARY KEY (user_id, category, item_id)
      );
    `);
    console.log("- Created 'user_question_progress' table");

    // 4. Projects Progress Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_projects_progress (
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        project_name VARCHAR(150) NOT NULL,
        project_week VARCHAR(20) NOT NULL,
        completed BOOLEAN DEFAULT FALSE,
        github_url TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        rating INT DEFAULT NULL,
        time_spent_hours INT DEFAULT 0,
        PRIMARY KEY (user_id, project_name, project_week)
      );
    `);
    console.log("- Created 'user_projects_progress' table");

    // 5. Milestones Progress Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_milestones_progress (
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        milestone_name VARCHAR(100) NOT NULL,
        completed BOOLEAN DEFAULT FALSE,
        PRIMARY KEY (user_id, milestone_name)
      );
    `);
    console.log("- Created 'user_milestones_progress' table");

    // 6. Cheat Sheets Progress Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_cheat_sheets (
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        sheet_key VARCHAR(50) NOT NULL,
        content TEXT DEFAULT '',
        PRIMARY KEY (user_id, sheet_key)
      );
    `);
    console.log("- Created 'user_cheat_sheets' table");

    // 7. Target Companies Progress Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_target_companies (
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        company_name VARCHAR(100) NOT NULL,
        researched BOOLEAN DEFAULT FALSE,
        sql_practiced BOOLEAN DEFAULT FALSE,
        dsa_reviewed BOOLEAN DEFAULT FALSE,
        notes TEXT DEFAULT '',
        PRIMARY KEY (user_id, company_name)
      );
    `);
    console.log("- Created 'user_target_companies' table");

    console.log("Database schema setup complete!");
  } catch (err) {
    console.error("Error setting up database schema:", err);
  } finally {
    await client.end();
    console.log("Database connection closed.");
  }
}

main();
