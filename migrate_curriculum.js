require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("FATAL ERROR: DATABASE_URL is not set in environment variables!");
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString });
  
  try {
    console.log("Reading de_master_roadmap_database.json...");
    const rawData = fs.readFileSync('de_master_roadmap_database.json', 'utf8');
    const database = JSON.parse(rawData);
    console.log("JSON loaded successfully!");

    console.log("Connecting to PostgreSQL...");
    await client.connect();
    console.log("Connected!");

    // Create DDL for Curriculum Tables
    console.log("Creating curriculum tables...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS curriculum_calendar (
        day_number INT PRIMARY KEY,
        focus_area VARCHAR(255) DEFAULT '',
        morning_task TEXT DEFAULT '',
        afternoon_task TEXT DEFAULT '',
        evening_task TEXT DEFAULT '',
        daily_deliverable TEXT DEFAULT '',
        milestone VARCHAR(255) DEFAULT '',
        month VARCHAR(20) DEFAULT '',
        week VARCHAR(20) DEFAULT '',
        date VARCHAR(50) DEFAULT ''
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS curriculum_questions (
        category VARCHAR(30) NOT NULL,
        id INT NOT NULL,
        title TEXT DEFAULT '',
        question TEXT DEFAULT '',
        difficulty VARCHAR(20) DEFAULT '',
        topic VARCHAR(150) DEFAULT '',
        leetcode_link TEXT DEFAULT '',
        answer_key_points TEXT DEFAULT '',
        preparation_tips TEXT DEFAULT '',
        PRIMARY KEY (category, id)
      );
    `);

    await client.query(`DROP TABLE IF EXISTS curriculum_projects CASCADE`);
    await client.query(`
      CREATE TABLE curriculum_projects (
        name VARCHAR(150) NOT NULL,
        week VARCHAR(20) NOT NULL,
        month VARCHAR(20) DEFAULT '',
        type VARCHAR(50) DEFAULT '',
        focus TEXT DEFAULT '',
        technologies TEXT DEFAULT '',
        key_skills TEXT DEFAULT '',
        deliverables TEXT DEFAULT '',
        due_by VARCHAR(100) DEFAULT '',
        PRIMARY KEY (name, week)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS curriculum_milestones (
        name VARCHAR(100) PRIMARY KEY,
        type VARCHAR(50) DEFAULT '',
        award_rs INT DEFAULT 0,
        award_xp INT DEFAULT 0
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS curriculum_cheat_sheets (
        sheet_key VARCHAR(50) PRIMARY KEY,
        title VARCHAR(100) DEFAULT '',
        content TEXT DEFAULT ''
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS curriculum_target_companies (
        name VARCHAR(100) PRIMARY KEY
      );
    `);

    console.log("Curriculum tables created successfully. Seeding data...");

    // 1. Seed Calendar
    console.log("Seeding calendar...");
    await client.query('TRUNCATE TABLE curriculum_calendar CASCADE');
    for (const day of database.calendar) {
      await client.query(
        `INSERT INTO curriculum_calendar (day_number, focus_area, morning_task, afternoon_task, evening_task, daily_deliverable, milestone, month, week, date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          day.day_number,
          day.focus_area || '',
          day.morning_task || '',
          day.afternoon_task || '',
          day.evening_task || '',
          day.daily_deliverable || '',
          day.milestone || '',
          day.month || '',
          day.week || '',
          day.date || ''
        ]
      );
    }
    console.log(`- Seeded ${database.calendar.length} calendar days`);

    // 2. Seed Questions
    console.log("Seeding questions...");
    await client.query('TRUNCATE TABLE curriculum_questions CASCADE');
    const categories = [
      { key: 'sql_question_bank', name: 'sql' },
      { key: 'dsa_problems', name: 'dsa' },
      { key: 'pyspark_questions', name: 'pyspark' },
      { key: 'de_concepts', name: 'concepts' },
      { key: 'interview_prep', name: 'interview' }
    ];

    let totalQuestions = 0;
    for (const cat of categories) {
      const list = database[cat.key];
      if (!list) continue;
      for (const item of list) {
        await client.query(
          `INSERT INTO curriculum_questions (category, id, title, question, difficulty, topic, leetcode_link, answer_key_points, preparation_tips)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            cat.name,
            item.id,
            item.title || '',
            item.question || '',
            item.difficulty || '',
            item.topic || '',
            item.leetcode_link || '',
            item.answer_key_points || '',
            item.preparation_tips || ''
          ]
        );
        totalQuestions++;
      }
    }
    console.log(`- Seeded ${totalQuestions} curriculum questions`);

    // 3. Seed Projects
    console.log("Seeding projects...");
    await client.query('TRUNCATE TABLE curriculum_projects CASCADE');
    for (const p of database.projects) {
      await client.query(
        `INSERT INTO curriculum_projects (name, week, month, type, focus, technologies, key_skills, deliverables, due_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          p.name,
          p.week,
          p.month || '',
          p.type || '',
          p.focus || '',
          p.technologies || '',
          p.key_skills || '',
          p.deliverables || '',
          p.due_by || ''
        ]
      );
    }
    console.log(`- Seeded ${database.projects.length} projects`);

    // 4. Seed Milestones
    console.log("Seeding milestones...");
    await client.query('TRUNCATE TABLE curriculum_milestones CASCADE');
    for (const m of database.milestones) {
      await client.query(
        `INSERT INTO curriculum_milestones (name, type, award_rs, award_xp)
         VALUES ($1, $2, $3, $4)`,
        [
          m.name,
          m.type || '',
          m.award_rs || 0,
          m.award_xp || 0
        ]
      );
    }
    console.log(`- Seeded ${database.milestones.length} milestones`);

    // 5. Seed Cheat Sheets
    console.log("Seeding cheat sheet templates...");
    await client.query('TRUNCATE TABLE curriculum_cheat_sheets CASCADE');
    if (database.cheat_sheets) {
      for (const [key, val] of Object.entries(database.cheat_sheets)) {
        await client.query(
          `INSERT INTO curriculum_cheat_sheets (sheet_key, title, content)
           VALUES ($1, $2, $3)`,
          [
            key,
            key.replace('_', ' ').toUpperCase(),
            val.content || ''
          ]
        );
      }
      console.log(`- Seeded ${Object.keys(database.cheat_sheets).length} cheat sheets`);
    }

    // 6. Seed Target Companies
    console.log("Seeding target companies...");
    await client.query('TRUNCATE TABLE curriculum_target_companies CASCADE');
    if (database.target_companies) {
      for (const c of database.target_companies) {
        await client.query(
          `INSERT INTO curriculum_target_companies (name) VALUES ($1)`,
          [c.name]
        );
      }
      console.log(`- Seeded ${database.target_companies.length} target companies`);
    }

    console.log("Data migration successfully completed!");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await client.end();
    console.log("PostgreSQL connection closed.");
  }
}

main();
