import React, { useState, useEffect } from 'react';
import { marked } from 'marked';
import {
  LayoutDashboard,
  Calendar,
  Code,
  Folder,
  FileText,
  Settings,
  Shield,
  LogOut,
  Flame,
  Zap,
  Check,
  X,
  Search,
  AlertTriangle,
  Save,
  Loader2,
  Lock,
  MessageSquare,
  TrendingUp,
  User,
  HelpCircle,
  Play,
  BookOpen,
  DollarSign,
  Database,
  Sparkles,
  CheckCircle2,
  Award,
  ArrowRight,
  BrainCircuit,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

// Configure marked options for GFM
marked.setOptions({
  gfm: true,
  breaks: true,
});

function parseMarkdown(text) {
  if (!text) return '';
  try {
    return marked.parse(text);
  } catch (e) {
    return text;
  }
}

// Timezone-aware local date helper
function getLocalDateString() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const localDate = new Date(d.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
}

export default function App() {
  // App Config and Core State
  const [currentUser, setCurrentUser] = useState(null);
  const [db, setDb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeQBankTab, setActiveQBankTab] = useState('sql');
  const [qbankFilters, setQbankFilters] = useState({ search: '', difficulty: '', status: '' });
  const [notifications, setNotifications] = useState([]);
  
  // Dashboard Active Day selector state
  const [dashboardDayNumber, setDashboardDayNumber] = useState(1);

  // Modal toggles
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [selectedQuestionCategory, setSelectedQuestionCategory] = useState('sql');
  const [workspaceTab, setWorkspaceTab] = useState('code');
  const [workspaceCode, setWorkspaceCode] = useState('');
  const [workspaceNotes, setWorkspaceNotes] = useState('');
  const [aiSubTab, setAiSubTab] = useState('schema');
  const [aiChatQuery, setAiChatQuery] = useState('');

  // Granular AI Loading States (Prevents triggering spinners on unclicked buttons!)
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [evalLoading, setEvalLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);

  // DE Playground State
  const [playgroundTopic, setPlaygroundTopic] = useState('scd');
  const [playgroundPrompt, setPlaygroundPrompt] = useState('');
  const [playgroundContent, setPlaygroundContent] = useState('');
  const [playgroundLoading, setPlaygroundLoading] = useState(false);

  // AI Quiz Modal State
  const [quizModalOpen, setQuizModalOpen] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizLoading, setQuizLoading] = useState(false);

  // Authentication overlays state
  const [authMode, setAuthMode] = useState('login');
  const [loginForm, setLoginForm] = useState({ email: '', pin: '' });
  const [signupForm, setSignupForm] = useState({ name: '', email: '', goal: '', pin: '' });

  // Admin Dashboard State
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminSearch, setAdminSearch] = useState('');
  const [adminSelectedUser, setAdminSelectedUser] = useState(null);
  const [adminSelectedUserProgress, setAdminSelectedUserProgress] = useState(null);
  const [adminInspectTab, setAdminInspectTab] = useState('overview');
  const [adminInspectDay, setAdminInspectDay] = useState(null);
  const [adminInspectCategory, setAdminInspectCategory] = useState('sql');
  const [adminInspectQId, setAdminInspectQId] = useState(null);

  // Determine backend URL
  const hostname = window.location.hostname;
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '';
  let API_BASE_URL = localStorage.getItem('de_tracker_backend_url') || '';
  if (!API_BASE_URL) {
    API_BASE_URL = isLocal ? 'http://localhost:8000' : '';
  }
  if (API_BASE_URL.endsWith('/')) {
    API_BASE_URL = API_BASE_URL.slice(0, -1);
  }

  // Toast Notification handler
  const showNotification = (message, type = 'success') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4500);
  };

  // 1. Initial Load: Fetch Curriculum and Check Session
  useEffect(() => {
    async function init() {
      try {
        const resCurriculum = await fetch(API_BASE_URL + '/de_master_roadmap_database.json');
        if (!resCurriculum.ok) throw new Error("Could not load curriculum data.");
        const baselineData = await resCurriculum.json();

        const sessionUser = localStorage.getItem('de_tracker_user');
        if (sessionUser) {
          const parsedUser = JSON.parse(sessionUser);
          setCurrentUser(parsedUser);

          const resProgress = await fetch(API_BASE_URL + `/api/user/${parsedUser.id}/data`);
          if (!resProgress.ok) {
            logout();
            return;
          }
          const progressPayload = await resProgress.json();
          mergeUserProgress(baselineData, progressPayload);

          // Set default dashboard day to first uncompleted day
          const uncompletedIndex = (baselineData.calendar || []).findIndex(d => !d.completed);
          if (uncompletedIndex !== -1) {
            setDashboardDayNumber(baselineData.calendar[uncompletedIndex].day_number);
          }
        } else {
          setDb(baselineData);
        }
      } catch (err) {
        console.error(err);
        showNotification("Could not initialize database. Verify connection or refresh.", "error");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const logout = () => {
    localStorage.removeItem('de_tracker_user');
    setCurrentUser(null);
    window.location.reload();
  };

  // Helper to merge database progress row arrays into structural baseline state
  const mergeUserProgress = (baseline, data) => {
    const merged = { ...baseline };

    // Merge User Profile
    const profile = data.profile || null;
    merged.user_profile = {
      name: profile?.name || currentUser?.name || 'Student',
      email: profile?.email || currentUser?.email || '',
      goal: profile?.goal || currentUser?.goal || '',
      target_companies: profile?.target_companies || [],
      daily_study_hours: profile?.daily_study_hours || 5,
      balance: profile?.balance || 0,
      current_streak: profile?.current_streak || 0,
      best_streak: profile?.best_streak || 0,
      xp: profile?.xp || 0,
      level: Math.floor((profile?.xp || 0) / 100) + 1,
      ai_coach_calls: profile?.ai_coach_calls || 0,
      gemini_api_key: profile?.gemini_api_key || '',
      simulated_date: profile?.simulated_date || getLocalDateString(),
      last_checkin_date: profile?.last_checkin_date,
      last_quest_date: profile?.last_quest_date,
      claimed_checkin_dates: profile?.claimed_checkin_dates || [],
      daily_quests: profile?.daily_quests || [],
      total_money_earned: profile?.total_money_earned || 0,
      weekly_money_earned: profile?.weekly_money_earned || 0,
      current_week: profile?.current_week || 1
    };

    // Merge Calendar Days
    const calendarRows = data.calendar || [];
    calendarRows.forEach(row => {
      const targetDay = merged.calendar.find(d => d.day_number === row.day_number);
      if (targetDay) {
        targetDay.completed = row.completed;
        targetDay.morning_completed = row.morning_completed;
        targetDay.afternoon_completed = row.afternoon_completed;
        targetDay.evening_completed = row.evening_completed;
        targetDay.penalized = row.penalized;
        targetDay.notes = row.notes || '';
        targetDay.time_spent_minutes = row.time_spent_minutes || 0;
        targetDay.rating = row.rating;
        targetDay.daily_reward_earned = row.daily_reward_earned || 0;
        targetDay.reward_claimed = row.reward_claimed || false;
      }
    });

    // Merge Questions
    const questionRows = data.questions || [];
    questionRows.forEach(row => {
      let qList = [];
      if (row.category === 'sql') qList = merged.sql_question_bank;
      else if (row.category === 'dsa') qList = merged.dsa_problems;
      else if (row.category === 'pyspark') qList = merged.pyspark_questions;
      else if (row.category === 'concepts') qList = merged.de_concepts;
      else if (row.category === 'interview') qList = merged.interview_prep;

      const targetQ = qList.find(q => q.id === row.item_id);
      if (targetQ) {
        targetQ.solved = row.solved;
        targetQ.notes = row.notes || '';
        targetQ.solution_code = row.solution_code || '';
        targetQ.confidence_level = row.confidence_level || 0;
        targetQ.attempts = row.attempts || 0;
        targetQ.ai_schema_context = row.ai_schema_context || null;
        targetQ.ai_code_review_hint = row.ai_code_review_hint || null;
        targetQ.ai_chat_history = row.ai_chat_history || [];
        targetQ.ai_score = row.ai_score !== undefined ? row.ai_score : null;
        targetQ.ai_feedback = row.ai_feedback || '';
      }
    });

    // Merge Projects
    const projectRows = data.projects || [];
    projectRows.forEach(row => {
      const targetProj = merged.projects.find(p => p.name === row.project_name);
      if (targetProj) {
        targetProj.completed = row.completed;
        targetProj.github_url = row.github_url || '';
        targetProj.notes = row.notes || '';
        targetProj.rating = row.rating;
        targetProj.time_spent_hours = row.time_spent_hours || 0;
      }
    });

    // Merge Milestones
    const milestoneRows = data.milestones || [];
    milestoneRows.forEach(row => {
      const targetMs = merged.milestones.find(m => m.name === row.milestone_name);
      if (targetMs) {
        targetMs.completed = row.completed;
      }
    });

    // Merge Cheatsheets
    const cheatsheetRows = data.cheat_sheets || [];
    cheatsheetRows.forEach(row => {
      if (merged.cheat_sheets[row.sheet_key]) {
        merged.cheat_sheets[row.sheet_key].content = row.content || '';
      }
    });

    // Merge Quizzes
    merged.quizzes = data.quizzes || [];

    setDb(merged);
  };

  // Synchronizers communicating client updates to PostgreSQL
  const syncProfile = async (updatedProfile) => {
    if (!currentUser) return;
    try {
      await fetch(API_BASE_URL + `/api/user/${currentUser.id}/update-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedProfile)
      });
    } catch (err) {
      console.error("Profile sync error:", err);
    }
  };

  const syncCalendarDay = async (day) => {
    if (!currentUser) return;
    try {
      await fetch(API_BASE_URL + `/api/user/${currentUser.id}/update-calendar-day`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day_number: day.day_number,
          morning_completed: day.morning_completed,
          afternoon_completed: day.afternoon_completed,
          evening_completed: day.evening_completed,
          completed: day.completed,
          penalized: day.penalized,
          notes: day.notes,
          time_spent_minutes: day.time_spent_minutes,
          rating: day.rating,
          daily_reward_earned: day.daily_reward_earned || 0,
          reward_claimed: day.reward_claimed || false
        })
      });
    } catch (err) {
      console.error("Calendar day sync error:", err);
    }
  };

  const syncQuestion = async (category, question) => {
    if (!currentUser) return;
    try {
      await fetch(API_BASE_URL + `/api/user/${currentUser.id}/update-question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          item_id: question.id,
          solved: question.solved || false,
          notes: question.notes || '',
          solution_code: question.solution_code || '',
          confidence_level: question.confidence_level || 0,
          attempts: question.attempts || 0,
          ai_schema_context: question.ai_schema_context || null,
          ai_code_review_hint: question.ai_code_review_hint || null,
          ai_chat_history: question.ai_chat_history || [],
          ai_score: question.ai_score !== undefined ? question.ai_score : null,
          ai_feedback: question.ai_feedback || ''
        })
      });
    } catch (err) {
      console.error("Question sync error:", err);
    }
  };

  // Server-side verification for claiming daily reward money
  const claimDailyRewardMoney = async (dayNumber, linkedCategory, linkedItemId) => {
    if (!currentUser) return;
    try {
      const res = await fetch(API_BASE_URL + `/api/user/${currentUser.id}/claim-reward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day_number: dayNumber,
          question_category: linkedCategory,
          question_item_id: linkedItemId
        })
      });
      const data = await res.json();
      if (!res.ok) {
        showNotification(`⚠️ ${data.error || 'Reward claim failed'}`, 'error');
        return;
      }

      // Update state locally
      const updatedCalendar = [...db.calendar];
      const day = updatedCalendar.find(d => d.day_number === dayNumber);
      if (day) {
        day.reward_claimed = true;
        day.daily_reward_earned = data.rewardAmount;
      }

      const updatedProfile = {
        ...db.user_profile,
        total_money_earned: data.total_money_earned,
        weekly_money_earned: data.weekly_money_earned
      };

      setDb(prev => ({
        ...prev,
        calendar: updatedCalendar,
        user_profile: updatedProfile
      }));

      showNotification(`🎉 ${data.message}`, 'success');
    } catch (err) {
      showNotification('Network error claiming reward.', 'error');
    }
  };

  const syncProject = async (proj) => {
    if (!currentUser) return;
    try {
      await fetch(API_BASE_URL + `/api/user/${currentUser.id}/update-project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_name: proj.name,
          project_week: proj.week,
          completed: proj.completed,
          github_url: proj.github_url || '',
          notes: proj.notes || '',
          rating: proj.rating || null,
          time_spent_hours: proj.time_spent_hours || 0
        })
      });
    } catch (err) {
      console.error("Project sync error:", err);
    }
  };

  const syncCheatSheet = async (key, sheet) => {
    if (!currentUser) return;
    try {
      await fetch(API_BASE_URL + `/api/user/${currentUser.id}/update-cheatsheet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheet_key: key,
          content: sheet.content || ''
        })
      });
    } catch (err) {
      console.error("Cheat sheet sync error:", err);
    }
  };

  // Reset progress logic
  const handleResetDatabase = async () => {
    if (!window.confirm("Are you absolutely sure you want to delete all notes, codes, and tracker progress from the database? This action is irreversible.")) {
      return;
    }
    try {
      const res = await fetch(API_BASE_URL + `/api/user/${currentUser.id}/reset`, {
        method: 'POST'
      });
      if (res.ok) {
        showNotification("All tracker data has been reset to baseline!", "success");
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        showNotification("Failed to reset database progress.", "error");
      }
    } catch (err) {
      showNotification("Error communicating reset trigger to server.", "error");
    }
  };

  // User Authentication Submit Triggers
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    try {
      if (authMode === 'login') {
        if (!loginForm.email || !loginForm.pin) {
          alert("Please fill in email and login PIN!");
          return;
        }
        const res = await fetch(API_BASE_URL + '/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(loginForm)
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || "Login credentials failed!");
          return;
        }
        localStorage.setItem('de_tracker_user', JSON.stringify(data.user));
        window.location.reload();
      } else {
        if (!signupForm.name || !signupForm.email || !signupForm.pin) {
          alert("Name, Email, and PIN are required for Signup!");
          return;
        }
        const res = await fetch(API_BASE_URL + '/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(signupForm)
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || "Signup error!");
          return;
        }
        localStorage.setItem('de_tracker_user', JSON.stringify(data.user));
        window.location.reload();
      }
    } catch (err) {
      console.error(err);
      alert("API request authentication failure.");
    }
  };

  // Admin Authentication & Listing Triggers
  const handleAdminVerify = async (e) => {
    e.preventDefault();
    if (adminPinInput === '6565') {
      setAdminAuthenticated(true);
      showNotification("Access granted to administrator cockpit.", "success");
      loadAdminDirectory();
    } else {
      alert("❌ Invalid security PIN.");
    }
  };

  const loadAdminDirectory = async () => {
    try {
      const res = await fetch(API_BASE_URL + '/api/admin/users');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAdminUsers(data.users || []);
    } catch (err) {
      showNotification("Failed to fetch admin users directory.", "error");
    }
  };

  const deleteUserAccount = async (userId, name) => {
    if (!window.confirm(`⚠️ WARNING: Are you sure you want to completely delete "${name}"? All progress is destroyed.`)) {
      return;
    }
    try {
      const res = await fetch(API_BASE_URL + `/api/admin/user/${userId}`, { method: 'DELETE' });
      if (res.ok) {
        showNotification("User wiped successfully.", "success");
        if (adminSelectedUser && adminSelectedUser.id === userId) {
          setAdminSelectedUser(null);
          setAdminSelectedUserProgress(null);
        }
        loadAdminDirectory();
      } else {
        alert("Failed to delete user.");
      }
    } catch (err) {
      alert("Delete transaction failed.");
    }
  };

  const selectUserAdminInspect = async (user) => {
    setAdminSelectedUser(user);
    setAdminSelectedUserProgress(null);
    try {
      const res = await fetch(API_BASE_URL + `/api/user/${user.id}/data`);
      if (res.ok) {
        const progress = await res.json();
        const resBaseline = await fetch(API_BASE_URL + '/de_master_roadmap_database.json');
        const baseline = await resBaseline.json();
        mergeUserProgress(baseline, progress);
        setAdminSelectedUserProgress(baseline);
      }
    } catch (err) {
      alert("Failed loading user inspection payload.");
    }
  };

  // Upgraded Gemini AI Coach Integration
  const callGemini = async (systemInstruction, promptText) => {
    const apiKey = db?.user_profile?.gemini_api_key;
    if (!apiKey) {
      throw new Error("No Gemini API key defined in Settings! Please add your key first.");
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
    const payload = {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: "user", parts: [{ text: promptText }] }]
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || "Gemini endpoint error.");
    }
    const data = await res.json();
    return data.candidates[0].content.parts[0].text;
  };

  // AI Feature 1: Generate Mock Database Tables & Schema Context for SQL/Coding
  const generateSchemaMockTables = async () => {
    setSchemaLoading(true);
    const sys = "You are an expert Data Engineering Mentor. Generate realistic, clear SQL database schemas with sample rows and column definitions. You must NEVER reveal the solution code. Format output as clean Markdown tables with header bars and bold column descriptions.";
    const prompt = `
      Category: ${selectedQuestionCategory.toUpperCase()}
      Question: ${selectedQuestion.question || selectedQuestion.title}
      Topic: ${selectedQuestion.topic || selectedQuestion.pattern || "General"}

      Task:
      Generate 2-3 realistic database table schemas (e.g. \`customers\`, \`orders\`, \`logs\`) with column names, data types, primary/foreign key indicators, and 3-5 sample rows of dummy data.
      Explain what problem this table schema models in Data Engineering.

      Format using clean Markdown tables. DO NOT write any SQL solution queries.
    `;

    try {
      const result = await callGemini(sys, prompt);
      const updatedQ = { ...selectedQuestion, ai_schema_context: result };
      setSelectedQuestion(updatedQ);

      let list = getQuestionList(selectedQuestionCategory);
      const idx = list.findIndex(q => q.id === selectedQuestion.id);
      if (idx !== -1) list[idx] = updatedQ;

      const updatedProfile = {
        ...db.user_profile,
        xp: db.user_profile.xp + 10,
        ai_coach_calls: (db.user_profile.ai_coach_calls || 0) + 1
      };
      updatedProfile.level = Math.floor(updatedProfile.xp / 100) + 1;

      setDb(prev => ({
        ...prev,
        user_profile: updatedProfile
      }));

      syncProfile(updatedProfile);
      syncQuestion(selectedQuestionCategory, updatedQ);
      showNotification("📊 Schema tables generated! +10 XP");
    } catch (err) {
      showNotification(`❌ ${err.message}`, "error");
    } finally {
      setSchemaLoading(false);
    }
  };

  // AI Feature 2: Auto-Scorer (0-10) with Critique & Hints
  const evaluateAndRateSolution = async () => {
    if (!workspaceCode.trim()) {
      alert("Please write some code inside the editor before asking the coach to evaluate!");
      return;
    }
    setEvalLoading(true);

    const sys = "You are a strict yet encouraging Data Engineering Code Reviewer. You evaluate student code against schema requirements. You MUST start your response with a line formatted exactly as: 'SCORE: X/10' (where X is an integer from 0 to 10). Next, provide a detailed review highlighting what works, logical flaws, performance concerns, and 2-3 step-by-step hints. NEVER give the direct solution code.";
    const prompt = `
      Question: ${selectedQuestion.question || selectedQuestion.title}
      Category: ${selectedQuestionCategory.toUpperCase()}
      
      Reference Database Schema Context:
      ${selectedQuestion.ai_schema_context || "Standard relational/big-data table."}
      
      Student's Code Solution:
      \`\`\`
      ${workspaceCode}
      \`\`\`

      Task:
      Evaluate the student's solution.
      Output format:
      SCORE: <0-10>/10
      
      ### Code Review Breakdown
      - **Correctness & Logic:** ...
      - **Edge Cases & Efficiency:** ...
      
      ### Incremental Hints
      1. ...
      2. ...
    `;

    try {
      const result = await callGemini(sys, prompt);

      let scoreVal = null;
      const match = result.match(/SCORE:\s*(\d{1,2})\/10/i);
      if (match) {
        scoreVal = parseInt(match[1]);
      } else {
        scoreVal = 7;
      }

      const updatedQ = {
        ...selectedQuestion,
        ai_code_review_hint: result,
        ai_score: scoreVal,
        ai_feedback: result,
        solved: scoreVal >= 7
      };
      setSelectedQuestion(updatedQ);

      let list = getQuestionList(selectedQuestionCategory);
      const idx = list.findIndex(q => q.id === selectedQuestion.id);
      if (idx !== -1) list[idx] = updatedQ;

      let bonusXp = 15;
      if (scoreVal >= 8) bonusXp += 50;

      const updatedProfile = {
        ...db.user_profile,
        xp: db.user_profile.xp + bonusXp,
        ai_coach_calls: (db.user_profile.ai_coach_calls || 0) + 1
      };
      updatedProfile.level = Math.floor(updatedProfile.xp / 100) + 1;

      setDb(prev => ({
        ...prev,
        user_profile: updatedProfile
      }));

      syncProfile(updatedProfile);
      syncQuestion(selectedQuestionCategory, updatedQ);

      // Auto-switch tab to AI Review pane so student sees score & feedback popup immediately!
      setWorkspaceTab('coach');
      setAiSubTab('hint');

      if (scoreVal >= 8) {
        showNotification(`🏆 High Distinction! AI Score: ${scoreVal}/10! +${bonusXp} XP`);
      } else {
        showNotification(`💡 AI Score: ${scoreVal}/10. Review feedback on the right pane!`);
      }
    } catch (err) {
      showNotification(`❌ ${err.message}`, "error");
    } finally {
      setEvalLoading(false);
    }
  };

  const sendAICustomDoubt = async (e) => {
    e.preventDefault();
    if (!aiChatQuery.trim()) return;
    setChatLoading(true);

    const sys = "You are the Data Engineering Coach. You help the user debug. You must NEVER give the direct solution code. Guide them through hints, questions, or edge cases.";
    const userMessage = { role: "user", text: aiChatQuery };
    const currentHistory = [...(selectedQuestion.ai_chat_history || []), userMessage];

    let promptContext = `Question: ${selectedQuestion.question || selectedQuestion.title}\n\n`;
    currentHistory.forEach(msg => {
      promptContext += `${msg.role === 'coach' ? 'Coach' : 'User'}: ${msg.text}\n`;
    });
    promptContext += "\nCoach response (NEVER write SQL or Python code solutions):";

    try {
      const result = await callGemini(sys, promptContext);
      const coachMessage = { role: "coach", text: result };
      const updatedHistory = [...currentHistory, coachMessage];
      const updatedQ = { ...selectedQuestion, ai_chat_history: updatedHistory };
      setSelectedQuestion(updatedQ);

      let list = getQuestionList(selectedQuestionCategory);
      const idx = list.findIndex(q => q.id === selectedQuestion.id);
      if (idx !== -1) list[idx] = updatedQ;

      syncQuestion(selectedQuestionCategory, updatedQ);
      setAiChatQuery('');
    } catch (err) {
      showNotification(`❌ ${err.message}`, "error");
    } finally {
      setChatLoading(false);
    }
  };

  // AI Feature 3: DE Playground Concept Explainer
  const generatePlaygroundConcept = async (topicKey, userQuery) => {
    setPlaygroundLoading(true);
    const sys = "You are a world-class Data Engineering Teacher explaining concepts to a beginner student. Use clear analogies, ASCII or Markdown architecture diagrams, real-world ETL pipeline scenarios (e.g. Uber, Netflix), and 3 flashcards. Make it encouraging and engaging. Format nicely in Markdown.";
    const prompt = `
      Topic: ${topicKey}
      Student Question: ${userQuery || "Explain this concept from scratch with real-world Data Engineering examples."}

      Task:
      1. Simple 2-sentence summary.
      2. Comprehensive breakdown with a diagram (ASCII or Markdown).
      3. Real-world scenario (e.g. Netflix, Uber data pipeline).
      4. 3 Quick Flashcards (Concept vs Alternative).
    `;

    try {
      const result = await callGemini(sys, prompt);
      setPlaygroundContent(result);
    } catch (err) {
      setPlaygroundContent("❌ Error generating explanation. Please check your Gemini API key in Settings.");
    } finally {
      setPlaygroundLoading(false);
    }
  };

  // AI Feature 4: Generate Interactive Topic Quiz
  const generateAIQuiz = async (dayTopic) => {
    setQuizLoading(true);
    setQuizSubmitted(false);
    setQuizAnswers({});

    const sys = "You generate 3 multiple-choice questions for a beginner Data Engineering student based on a curriculum topic. Output strictly valid JSON without markdown codeblock syntax, formatted as an array of objects: [{\"question\":\"...\", \"options\":[\"...\", \"...\", \"...\", \"...\"], \"answerIndex\":0, \"explanation\":\"...\"}].";
    const prompt = `Generate 3 multiple choice questions for Data Engineering topic: "${dayTopic}"`;

    try {
      const rawText = await callGemini(sys, prompt);
      const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      setQuizQuestions(parsed);
      setQuizModalOpen(true);
    } catch (err) {
      showNotification("Could not generate quiz. Check Gemini API key in Settings.", "error");
    } finally {
      setQuizLoading(false);
    }
  };

  const submitQuiz = () => {
    setQuizSubmitted(true);
    let correctCount = 0;
    quizQuestions.forEach((q, idx) => {
      if (quizAnswers[idx] === q.answerIndex) correctCount++;
    });

    let bonusXp = correctCount * 15;
    if (correctCount === quizQuestions.length) bonusXp += 25;

    const updatedProfile = {
      ...db.user_profile,
      xp: db.user_profile.xp + bonusXp
    };
    updatedProfile.level = Math.floor(updatedProfile.xp / 100) + 1;

    setDb(prev => ({ ...prev, user_profile: updatedProfile }));
    syncProfile(updatedProfile);
    showNotification(`🎯 Quiz Completed! Score: ${correctCount}/${quizQuestions.length}. +${bonusXp} XP!`);
  };

  // Helper selectors
  const getQuestionList = (cat) => {
    if (!db) return [];
    if (cat === 'sql') return db.sql_question_bank || [];
    if (cat === 'dsa') return db.dsa_problems || [];
    if (cat === 'pyspark') return db.pyspark_questions || [];
    if (cat === 'concepts') return db.de_concepts || [];
    if (cat === 'interview') return db.interview_prep || [];
    return [];
  };

  // Helper: Find targeted linked questions for a given day (max 2-4 questions)
  const getLinkedQuestionsForDay = (day) => {
    if (!day || !db) return [];
    
    const dayText = `${day.focus_area || ''} ${day.topic || ''} ${day.morning_task || ''} ${day.afternoon_task || ''} ${day.evening_task || ''}`.toLowerCase();
    const linked = [];
    const seenIds = new Set();

    const stopWords = ['the', 'and', 'for', 'all', 'sql', 'dsa', 'basic', 'easy', 'data', 'code', 'with', 'from', 'table', 'tables', 'type', 'types', 'into', 'select'];
    const isMatch = (keyword) => {
      if (!keyword || keyword.length < 3) return false;
      const kw = keyword.toLowerCase().trim();
      if (stopWords.includes(kw)) return false;
      return dayText.includes(kw);
    };

    // Search SQL bank
    (db.sql_question_bank || []).forEach(q => {
      const qKey = `sql-${q.id}`;
      if (!seenIds.has(qKey)) {
        if (isMatch(q.topic) || isMatch(q.question)) {
          seenIds.add(qKey);
          linked.push({ category: 'sql', ...q });
        }
      }
    });

    // Search DSA bank
    (db.dsa_problems || []).forEach(q => {
      const qKey = `dsa-${q.id}`;
      if (!seenIds.has(qKey)) {
        if (isMatch(q.pattern) || isMatch(q.title)) {
          seenIds.add(qKey);
          linked.push({ category: 'dsa', ...q });
        }
      }
    });

    // Search PySpark bank
    (db.pyspark_questions || []).forEach(q => {
      const qKey = `pyspark-${q.id}`;
      if (!seenIds.has(qKey)) {
        if (isMatch(q.topic) || isMatch(q.question)) {
          seenIds.add(qKey);
          linked.push({ category: 'pyspark', ...q });
        }
      }
    });

    // Fallback: If no specific keyword matches, link 2 questions by day_number modulo (1 SQL + 1 DSA)
    if (linked.length === 0) {
      const dayNum = day.day_number || 1;
      if (db.sql_question_bank && db.sql_question_bank.length > 0) {
        const sqlIdx = (dayNum - 1) % db.sql_question_bank.length;
        linked.push({ category: 'sql', ...db.sql_question_bank[sqlIdx] });
      }
      if (db.dsa_problems && db.dsa_problems.length > 0) {
        const dsaIdx = (dayNum - 1) % db.dsa_problems.length;
        linked.push({ category: 'dsa', ...db.dsa_problems[dsaIdx] });
      }
    }

    // Return at most 4 questions for a clean UI
    return linked.slice(0, 4);
  };

  // Checkbox Checkin System (Calendar Day Completion)
  const toggleCalendarTask = (dayNumber, taskKey) => {
    const updatedCalendar = [...db.calendar];
    const day = updatedCalendar.find(d => d.day_number === dayNumber);
    if (!day) return;

    day[taskKey] = !day[taskKey];

    const allChecked = day.morning_completed && day.afternoon_completed && day.evening_completed;
    const wasCompleted = day.completed;
    day.completed = allChecked;

    let xpGained = 0;
    if (day[taskKey]) {
      if (taskKey === 'morning_completed') xpGained += 15;
      else if (taskKey === 'afternoon_completed') xpGained += 15;
      else if (taskKey === 'evening_completed') xpGained += 20;
    } else {
      if (taskKey === 'morning_completed') xpGained -= 15;
      else if (taskKey === 'afternoon_completed') xpGained -= 15;
      else if (taskKey === 'evening_completed') xpGained -= 20;
    }

    if (allChecked && !wasCompleted) {
      xpGained += 50;
      showNotification("☀️ Day tasks complete!");
    } else if (!allChecked && wasCompleted) {
      xpGained -= 50;
    }

    let currentStreak = db.user_profile.current_streak || 0;
    let bestStreak = db.user_profile.best_streak || 0;
    const todayStr = db.user_profile.simulated_date || getLocalDateString();
    
    if (allChecked && !wasCompleted) {
      if (db.user_profile.last_checkin_date !== todayStr) {
        const lastCheckin = db.user_profile.last_checkin_date;
        if (!lastCheckin) {
          currentStreak = 1;
        } else {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];
          if (lastCheckin === yesterdayStr) {
            currentStreak += 1;
          } else if (lastCheckin !== todayStr) {
            currentStreak = 1;
          }
        }
        if (currentStreak > bestStreak) bestStreak = currentStreak;
        db.user_profile.last_checkin_date = todayStr;
      }
    }

    const updatedProfile = {
      ...db.user_profile,
      xp: Math.max(0, db.user_profile.xp + xpGained),
      current_streak: currentStreak,
      best_streak: bestStreak
    };
    updatedProfile.level = Math.floor(updatedProfile.xp / 100) + 1;

    setDb(prev => ({
      ...prev,
      calendar: updatedCalendar,
      user_profile: updatedProfile
    }));

    syncCalendarDay(day);
    syncProfile(updatedProfile);
  };

  const saveDayDetails = () => {
    if (!selectedDay) return;
    const updatedCalendar = [...db.calendar];
    const day = updatedCalendar.find(d => d.day_number === selectedDay.day_number);
    if (day) {
      day.notes = selectedDay.notes;
      day.time_spent_minutes = selectedDay.time_spent_minutes;
      day.rating = selectedDay.rating;
    }
    setDb(prev => ({ ...prev, calendar: updatedCalendar }));
    syncCalendarDay(day);
    setSelectedDay(null);
    showNotification("📅 Day details saved successfully.");
  };

  // Solve Question and CLOSE Modal with Notification
  const handleSolveQuestion = (solvedState) => {
    const updatedQ = {
      ...selectedQuestion,
      solved: solvedState,
      solution_code: workspaceCode,
      notes: workspaceNotes,
      attempts: (selectedQuestion.attempts || 0) + (solvedState ? 1 : 0)
    };
    setSelectedQuestion(updatedQ);

    let list = getQuestionList(selectedQuestionCategory);
    const idx = list.findIndex(q => q.id === selectedQuestion.id);
    if (idx !== -1) list[idx] = updatedQ;

    let xpGained = 0;
    if (solvedState && !selectedQuestion.solved) {
      xpGained = 100;
    }

    const updatedProfile = {
      ...db.user_profile,
      xp: db.user_profile.xp + xpGained
    };
    updatedProfile.level = Math.floor(updatedProfile.xp / 100) + 1;

    setDb(prev => ({
      ...prev,
      user_profile: updatedProfile
    }));

    syncProfile(updatedProfile);
    syncQuestion(selectedQuestionCategory, updatedQ);

    // Show toast notification and CLOSE MODAL automatically!
    showNotification("💾 Solution saved successfully!", "success");
    setSelectedQuestion(null);
  };

  const toggleProject = (projectName, week, checked) => {
    const updatedProjects = [...db.projects];
    const proj = updatedProjects.find(p => p.name === projectName && p.week === week);
    if (!proj) return;

    proj.completed = checked;
    let xpGained = checked ? 500 : -500;

    if (checked) {
      showNotification("🚀 Megaproject Completed! +500 XP!");
    }

    const updatedProfile = {
      ...db.user_profile,
      xp: Math.max(0, db.user_profile.xp + xpGained)
    };
    updatedProfile.level = Math.floor(updatedProfile.xp / 100) + 1;

    setDb(prev => ({
      ...prev,
      projects: updatedProjects,
      user_profile: updatedProfile
    }));

    syncProject(proj);
    syncProfile(updatedProfile);
  };

  const updateProjectFields = (name, week, fields) => {
    const updatedProjects = [...db.projects];
    const proj = updatedProjects.find(p => p.name === name && p.week === week);
    if (proj) {
      Object.assign(proj, fields);
    }
    setDb(prev => ({ ...prev, projects: updatedProjects }));
    syncProject(proj);
  };

  // Loading spinner layout
  if (loading || !db) {
    return (
      <div className="fixed inset-0 flex flex-col justify-center items-center bg-slate-50 gap-4">
        <Loader2 className="animate-spin text-brand-600 h-10 w-10" />
        <h2 className="text-lg font-bold text-slate-800 font-main">Loading Curriculum Cockpit...</h2>
      </div>
    );
  }

  // Authentication page layout with Tailwind
  if (!currentUser) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-50 p-4 font-main">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xl w-full max-w-md text-center">
          <div className="mb-6">
            <h2 className="text-2xl font-black text-slate-900 flex items-center justify-center gap-2">
              <Code className="text-brand-600 h-7 w-7" />
              DE Mastery Tracker
            </h2>
            <p className="text-xs text-slate-500 mt-2">
              {authMode === 'login' ? 'Enter credentials to load database session' : 'Create a new account on Neon Cloud'}
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4 text-left">
            {authMode === 'signup' && (
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Full Name</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-sm"
                  value={signupForm.name}
                  onChange={e => setSignupForm({ ...signupForm, name: e.target.value })}
                  placeholder="Enter your name"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Email Address</label>
              <input
                type="email"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-sm"
                value={authMode === 'login' ? loginForm.email : signupForm.email}
                onChange={e => authMode === 'login'
                  ? setLoginForm({ ...loginForm, email: e.target.value })
                  : setSignupForm({ ...signupForm, email: e.target.value })}
                placeholder="you@example.com"
              />
            </div>

            {authMode === 'signup' && (
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">DE Target Goal</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-sm"
                  value={signupForm.goal}
                  onChange={e => setSignupForm({ ...signupForm, goal: e.target.value })}
                  placeholder="e.g. Data Engineer"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Security PIN (6565)</label>
              <input
                type="password"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-sm text-center tracking-widest font-mono"
                maxLength="6"
                value={authMode === 'login' ? loginForm.pin : signupForm.pin}
                onChange={e => authMode === 'login'
                  ? setLoginForm({ ...loginForm, pin: e.target.value })
                  : setSignupForm({ ...signupForm, pin: e.target.value })}
                placeholder="••••"
              />
            </div>

            <button type="submit" className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg transition-colors text-sm mt-6">
              {authMode === 'login' ? 'Sign In' : 'Sign Up'}
            </button>
          </form>

          <div className="text-center mt-6 text-xs text-slate-500">
            {authMode === 'login' ? (
              <span>New student? <a href="#" className="text-brand-600 font-bold hover:underline" onClick={() => setAuthMode('signup')}>Create Account</a></span>
            ) : (
              <span>Already registered? <a href="#" className="text-brand-600 font-bold hover:underline" onClick={() => setAuthMode('login')}>Sign In</a></span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Filter QBank lists
  const filteredQBankList = getQuestionList(activeQBankTab).filter(item => {
    const searchVal = qbankFilters.search.toLowerCase();
    const matchesSearch = (item.question || item.title || '').toLowerCase().includes(searchVal) ||
      (item.category || activeQBankTab || '').toLowerCase().includes(searchVal) ||
      (item.topic || item.pattern || '').toLowerCase().includes(searchVal);

    let matchesDiff = true;
    if (qbankFilters.difficulty) {
      matchesDiff = (item.difficulty || '').toLowerCase() === qbankFilters.difficulty.toLowerCase();
    }

    let matchesStatus = true;
    if (qbankFilters.status) {
      const isSolved = item.solved;
      if (qbankFilters.status === 'solved') matchesStatus = isSolved;
      else if (qbankFilters.status === 'unsolved') matchesStatus = !isSolved;
    }

    return matchesSearch && matchesDiff && matchesStatus;
  });

  // Calculate Next Level XP math cleanly
  const currentXp = db.user_profile?.xp || 0;
  const xpProgressInLevel = currentXp % 100;
  const xpNeededForNextLevel = 100 - xpProgressInLevel;

  return (
    <div className="flex min-h-screen bg-slate-50 font-main">
      
      {/* Toast notifications container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {notifications.map(n => (
          <div key={n.id} className={`px-4 py-3 rounded-xl text-xs font-bold text-white shadow-lg flex items-center gap-2 transition-all ${
            n.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
          }`}>
            <span>{n.message}</span>
          </div>
        ))}
      </div>

      {/* ================= LEFT SIDEBAR ================= */}
      <aside className="w-64 bg-white border-r border-slate-200 p-6 flex flex-col justify-between fixed h-screen overflow-y-auto z-40">
        <div>
          <div className="mb-8">
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Code className="text-brand-600 h-6 w-6" />
              DE Mastery
            </h1>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Curriculum Cockpit</div>
          </div>

          <nav className="space-y-1">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'calendar', label: '182-Day Calendar', icon: Calendar },
              { id: 'qbank', label: 'Question Banks', icon: Code },
              { id: 'playground', label: 'DE Playground', icon: BookOpen },
              { id: 'projects', label: 'Megaprojects', icon: Folder },
              { id: 'cheatsheets', label: 'Cheat Sheets', icon: FileText },
              { id: 'admin', label: 'Admin Cockpit', icon: Shield },
              { id: 'settings', label: 'Settings', icon: Settings },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <div
                  key={tab.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                    isActive ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-brand-700' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Profile and Signout panel */}
        <div className="border-t border-slate-200 pt-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center font-bold text-sm">
              {(db.user_profile?.name?.[0] || 'U').toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-bold text-slate-900 truncate">{db.user_profile?.name}</div>
              <div className="text-xs text-slate-500">Lvl {db.user_profile?.level} Student</div>
            </div>
          </div>
          <button
            className="w-full flex items-center justify-center gap-2 py-2 px-3 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            onClick={logout}
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ================= MAIN CONTENT SPACE ================= */}
      <main className="flex-1 ml-64 p-8 min-h-screen">
        <header className="flex justify-between items-center border-b border-slate-200 pb-6 mb-8">
          <div>
            <h2 className="text-2xl font-black text-slate-900">
              {activeTab === 'dashboard' && '📈 Student Learning Cockpit'}
              {activeTab === 'calendar' && '📅 182-Day Curriculum Tracker'}
              {activeTab === 'qbank' && '💻 Coding & SQL Studio'}
              {activeTab === 'playground' && '💡 DE Concept Learning Playground'}
              {activeTab === 'projects' && '🚀 Portfolio Megaprojects'}
              {activeTab === 'cheatsheets' && '📝 Developer Cheat Sheets'}
              {activeTab === 'admin' && '🛡️ Administrator Control Center'}
              {activeTab === 'settings' && '⚙️ Configuration & Settings'}
            </h2>
          </div>

          {/* Streaks & Money Widget */}
          <div className="flex gap-3 items-center">
            {/* Weekly Earnings Pill */}
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-extrabold border border-emerald-200 shadow-sm">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              <span>₹{db.user_profile?.weekly_money_earned || 0} / ₹1000 This Week</span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 text-brand-700 rounded-full text-xs font-bold border border-brand-100">
              <Zap className="h-3.5 w-3.5 text-brand-600 fill-brand-600" />
              <span>{db.user_profile?.xp} XP</span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full text-xs font-bold border border-amber-100">
              <Flame className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
              <span>{db.user_profile?.current_streak} Day Streak</span>
            </div>
          </div>
        </header>

        {/* ================= VIEW 1: DASHBOARD ================= */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            
            {/* Welcome Encouragement Banner */}
            <div className="bg-gradient-to-r from-brand-700 via-brand-600 to-teal-800 rounded-2xl p-6 text-white shadow-lg flex justify-between items-center">
              <div className="space-y-2">
                <span className="text-xs font-extrabold uppercase tracking-widest text-teal-200">Welcome to Data Engineering 🚀</span>
                <h3 className="text-2xl font-black">Hi {db.user_profile?.name}! Ready for today's learning?</h3>
                <p className="text-xs text-teal-100 max-w-xl leading-relaxed">
                  Master SQL queries, PySpark pipelines, data modeling, and algorithms. Complete today's checklist and score ≥ 8/10 on linked questions to earn your daily rewards!
                </p>
              </div>

              <button
                disabled={quizLoading}
                className="py-3 px-5 bg-white hover:bg-teal-50 text-brand-800 font-extrabold rounded-xl text-xs shadow-md transition-all flex items-center gap-2"
                onClick={() => {
                  const today = db.calendar.find(d => d.day_number === dashboardDayNumber) || db.calendar[0];
                  if (today) generateAIQuiz(today.topic);
                }}
              >
                {quizLoading ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4 text-brand-600" />
                    Generating Quiz...
                  </>
                ) : (
                  <>
                    <BrainCircuit className="h-4 w-4 text-brand-600" />
                    Take Today's AI Topic Quiz (+25 XP)
                  </>
                )}
              </button>
            </div>

            {/* Overview Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Level Progress</span>
                <span className="text-3xl font-black text-brand-600 mt-1">Level {db.user_profile?.level}</span>
                <span className="text-xs text-slate-500 mt-2">Next level in {xpNeededForNextLevel} XP</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Weekly Rewards</span>
                  <span className="text-xs font-bold text-emerald-600">Max ₹1000/wk</span>
                </div>
                <span className="text-3xl font-black text-emerald-600 mt-1">₹{db.user_profile?.weekly_money_earned || 0}</span>
                <div className="w-full bg-slate-100 rounded-full h-2 mt-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(100, ((db.user_profile?.weekly_money_earned || 0) / 1000) * 100)}%` }}
                  ></div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Money Earned</span>
                <span className="text-3xl font-black text-slate-900 mt-1">₹{db.user_profile?.total_money_earned || 0}</span>
                <span className="text-xs text-slate-500 mt-2">Accumulated rewards</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Completed Curriculum</span>
                <span className="text-3xl font-black text-slate-900 mt-1">
                  {db.calendar.filter(d => d.completed).length} / 182 Days
                </span>
                <span className="text-xs text-slate-500 mt-2">{Math.round((db.calendar.filter(d => d.completed).length / 182) * 100)}% finished</span>
              </div>
            </div>

            {/* Today's Focus & ALL Linked Questions (With Previous / Next Day Navigation Controls!) */}
            {(() => {
              const today = db.calendar.find(d => d.day_number === dashboardDayNumber) || db.calendar[0];
              if (!today) return null;

              const linkedQs = getLinkedQuestionsForDay(today);

              const dayInWeek = ((today.day_number - 1) % 7) + 1;
              const rewardSchedule = { 1: 100, 2: 120, 3: 140, 4: 150, 5: 160, 6: 165, 7: 165 };
              const rewardAmount = rewardSchedule[dayInWeek] || 100;

              // Check if at least 1 linked question has score >= 8
              const hasHighScoringQuestion = linkedQs.some(q => q.ai_score >= 8);

              return (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Left Column: Today's Tasks Checklist with Day Navigation Arrows */}
                  <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-3">
                        {/* Day Navigation Controls */}
                        <div className="flex items-center gap-1">
                          <button
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
                            onClick={() => setDashboardDayNumber(prev => Math.max(1, prev - 1))}
                            title="Previous Day"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <button
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
                            onClick={() => setDashboardDayNumber(prev => Math.min(182, prev + 1))}
                            title="Next Day"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>

                        <div>
                          <span className="text-[10px] font-bold text-brand-600 uppercase tracking-widest bg-brand-50 px-2.5 py-0.5 rounded-full">
                            Day {today.day_number} of 182 Focus
                          </span>
                          <h3 className="text-lg font-black text-slate-900 mt-1">{today.topic}</h3>
                        </div>
                      </div>

                      {/* Daily reward claim button */}
                      <div>
                        {today.reward_claimed ? (
                          <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            <span>Claimed ₹{today.daily_reward_earned}</span>
                          </div>
                        ) : (
                          <button
                            className={`py-2 px-4 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
                              today.completed && hasHighScoringQuestion
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md'
                                : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                            }`}
                            onClick={() => {
                              if (today.completed && hasHighScoringQuestion) {
                                const highQ = linkedQs.find(q => q.ai_score >= 8);
                                claimDailyRewardMoney(today.day_number, highQ?.category, highQ?.id);
                              } else {
                                alert(`🔒 To claim Day ${today.day_number} reward (₹${rewardAmount}):\n1. Complete all 3 daily tasks\n2. Solve at least one linked coding/SQL question with an AI Score >= 8/10`);
                              }
                            }}
                          >
                            <DollarSign className="h-4 w-4" />
                            Claim Reward (₹{rewardAmount})
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Daily Checklist Tasks */}
                    <div className="space-y-3 pt-2">
                      <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100/50 cursor-pointer select-none transition-colors">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500"
                          checked={today.morning_completed}
                          onChange={() => toggleCalendarTask(today.day_number, 'morning_completed')}
                        />
                        <span className="text-xs font-bold text-slate-700">🌅 Morning Task: {today.morning_task}</span>
                      </label>
                      <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100/50 cursor-pointer select-none transition-colors">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500"
                          checked={today.afternoon_completed}
                          onChange={() => toggleCalendarTask(today.day_number, 'afternoon_completed')}
                        />
                        <span className="text-xs font-bold text-slate-700">☀️ Afternoon Task: {today.afternoon_task}</span>
                      </label>
                      <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100/50 cursor-pointer select-none transition-colors">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500"
                          checked={today.evening_completed}
                          onChange={() => toggleCalendarTask(today.day_number, 'evening_completed')}
                        />
                        <span className="text-xs font-bold text-slate-700">🌙 Evening Task: {today.evening_task}</span>
                      </label>
                    </div>

                    <div className="flex justify-between items-center border-t border-slate-100 pt-3">
                      <span className="text-xs text-slate-500">
                        {today.completed ? '🎉 All tasks finished!' : 'Check off tasks to complete the day.'}
                      </span>
                      <button
                        className="py-1.5 px-3 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
                        onClick={() => setSelectedDay(today)}
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Log Study Time & Reflections
                      </button>
                    </div>
                  </div>

                  {/* Right Column: ALL Linked Questions for Today */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
                        <Code className="h-4 w-4 text-brand-600" />
                        Linked Practice Questions ({linkedQs.length})
                      </h4>

                      <div className="space-y-3 mt-3 max-h-[260px] overflow-y-auto pr-1">
                        {linkedQs.map((qItem, idx) => (
                          <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-brand-300 transition-colors space-y-2">
                            <div className="flex justify-between items-start">
                              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-100">
                                {qItem.category.toUpperCase()} #{qItem.id}
                              </span>
                              {qItem.ai_score !== null && (
                                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                  qItem.ai_score >= 8 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}>
                                  AI Score: {qItem.ai_score}/10
                                </span>
                              )}
                            </div>

                            <h5 className="text-xs font-bold text-slate-900 leading-snug">
                              {qItem.question || qItem.title}
                            </h5>

                            <button
                              className="w-full py-1.5 px-3 bg-brand-600 hover:bg-brand-700 text-white font-extrabold rounded-lg text-[11px] transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                              onClick={() => {
                                setSelectedQuestion(qItem);
                                setSelectedQuestionCategory(qItem.category);
                                setWorkspaceCode(qItem.solution_code || '');
                                setWorkspaceNotes(qItem.notes || '');
                                setWorkspaceTab('code');
                                setAiSubTab('schema');
                              }}
                            >
                              <Play className="h-3 w-3 fill-white" />
                              Open in Code Studio
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                </div>
              );
            })()}

          </div>
        )}

        {/* ================= VIEW 2: 182-DAY CALENDAR ================= */}
        {activeTab === 'calendar' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 lg:grid-cols-9 gap-4">
            {db.calendar.map(day => (
              <div
                key={day.day_number}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between h-24 shadow-sm hover:border-brand-500 hover:shadow-md ${
                  day.completed ? 'bg-teal-50/50 border-teal-200' : (day.penalized ? 'bg-red-50/50 border-red-200' : 'bg-white border-slate-200')
                }`}
                onClick={() => {
                  setSelectedDay(day);
                  setDashboardDayNumber(day.day_number);
                }}
              >
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold text-slate-400">Day {day.day_number}</span>
                  {day.completed && <Check className="text-teal-600 h-3.5 w-3.5 font-black" />}
                  {day.reward_claimed && <DollarSign className="text-emerald-600 h-3.5 w-3.5" />}
                </div>
                
                <span className="text-xs font-bold text-slate-700 line-clamp-2 mt-1">
                  {day.topic}
                </span>

                <div className="flex gap-1.5 mt-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${day.morning_completed ? 'bg-brand-500' : 'bg-slate-200'}`}></span>
                  <span className={`w-1.5 h-1.5 rounded-full ${day.afternoon_completed ? 'bg-brand-500' : 'bg-slate-200'}`}></span>
                  <span className={`w-1.5 h-1.5 rounded-full ${day.evening_completed ? 'bg-brand-500' : 'bg-slate-200'}`}></span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ================= VIEW 3: QUESTION BANKS ================= */}
        {activeTab === 'qbank' && (
          <div className="flex gap-8">
            
            {/* Left Bank Picker */}
            <div className="w-60 flex flex-col gap-1.5 flex-shrink-0">
              {[
                { id: 'sql', label: '💾 SQL Coding Studio' },
                { id: 'dsa', label: '🧩 DSA Algorithms' },
                { id: 'pyspark', label: '📊 PySpark Big Data' },
                { id: 'concepts', label: '📚 Core DE Concepts' },
                { id: 'interview', label: '🎙️ Scenario Interviews' },
              ].map(sub => (
                <div
                  key={sub.id}
                  className={`px-4 py-3 rounded-xl text-sm font-bold cursor-pointer transition-colors ${
                    activeQBankTab === sub.id ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  onClick={() => setActiveQBankTab(sub.id)}
                >
                  {sub.label}
                </div>
              ))}
            </div>

            {/* Right List Grid */}
            <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm p-6 overflow-hidden">
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search question, tags, patterns..."
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-sm"
                    value={qbankFilters.search}
                    onChange={e => setQbankFilters({ ...qbankFilters, search: e.target.value })}
                  />
                </div>
                
                <select
                  className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-sm bg-white"
                  value={qbankFilters.difficulty}
                  onChange={e => setQbankFilters({ ...qbankFilters, difficulty: e.target.value })}
                >
                  <option value="">All Difficulties</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>

                <select
                  className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-sm bg-white"
                  value={qbankFilters.status}
                  onChange={e => setQbankFilters({ ...qbankFilters, status: e.target.value })}
                >
                  <option value="">All Statuses</option>
                  <option value="solved">Solved</option>
                  <option value="unsolved">Unsolved</option>
                </select>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-bold text-slate-400 uppercase tracking-wider">
                      <th className="pb-3 text-center w-12">ID</th>
                      <th className="pb-3">Problem</th>
                      <th className="pb-3">Category</th>
                      <th className="pb-3">Topic / Pattern</th>
                      <th className="pb-3">AI Score</th>
                      <th className="pb-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQBankList.map(item => (
                      <tr
                        key={item.id}
                        onClick={() => {
                          setSelectedQuestion(item);
                          setSelectedQuestionCategory(activeQBankTab);
                          setWorkspaceCode(item.solution_code || '');
                          setWorkspaceNotes(item.notes || '');
                          setWorkspaceTab('code');
                          setAiSubTab('schema');
                        }}
                        className="border-b border-slate-100 hover:bg-slate-50/50 cursor-pointer text-sm font-main"
                      >
                        <td className="py-4 text-center text-slate-400 font-mono">#{item.id}</td>
                        <td className="py-4 font-bold text-slate-800">{item.question || item.title}</td>
                        <td className="py-4 font-bold text-slate-700 text-xs uppercase">{item.category ? item.category : activeQBankTab.toUpperCase()}</td>
                        <td className="py-4"><code className="font-code text-xs px-2 py-0.5 bg-slate-100 rounded text-slate-700">{item.topic || item.pattern || 'General'}</code></td>
                        <td className="py-4">
                          {item.ai_score !== null && item.ai_score !== undefined ? (
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                              item.ai_score >= 8 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              {item.ai_score}/10
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-mono">Unscored</span>
                          )}
                        </td>
                        <td className="py-4">
                          {item.solved ? (
                            <span className="text-[10px] font-bold bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full">✓ Solved</span>
                          ) : (
                            <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Unsolved</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredQBankList.length === 0 && (
                      <tr>
                        <td colSpan="7" className="text-center py-10 text-slate-400 text-sm">
                          No questions match current search filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          </div>
        )}

        {/* ================= VIEW 4: DE PLAYGROUND ================= */}
        {activeTab === 'playground' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <BookOpen className="text-brand-600 h-5 w-5" />
                  Data Engineering Concept Playground
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Select a topic or type custom questions to explore architectures, partitioning strategies, PySpark DataFrames, and Data Lake modeling.
                </p>
              </div>

              {/* Topic buttons */}
              <div className="flex flex-wrap gap-2 pt-2">
                {[
                  { id: 'scd', label: '🔄 SCD Type 1 vs Type 2' },
                  { id: 'partitioning', label: '⚡ Partitioning vs Bucketing' },
                  { id: 'pyspark', label: '🔥 PySpark RDD vs DataFrame' },
                  { id: 'star_schema', label: '⭐ Star vs Snowflake Schema' },
                  { id: 'etl_elt', label: '🔀 ETL vs ELT Architecture' },
                  { id: 'kafka', label: '📡 Kafka Topics & Partitions' },
                ].map(t => (
                  <button
                    key={t.id}
                    disabled={playgroundLoading}
                    className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all border ${
                      playgroundTopic === t.id ? 'bg-brand-600 text-white border-brand-600 shadow-sm' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                    onClick={() => {
                      setPlaygroundTopic(t.id);
                      generatePlaygroundConcept(t.label, '');
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Custom Ask AI prompt */}
              <div className="flex gap-2 pt-2">
                <input
                  type="text"
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500 text-xs"
                  placeholder="Ask AI to explain any DE concept (e.g., How does Delta Lake handle ACID transactions?)..."
                  value={playgroundPrompt}
                  onChange={e => setPlaygroundPrompt(e.target.value)}
                />
                <button
                  disabled={playgroundLoading}
                  className="py-2 px-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5"
                  onClick={() => generatePlaygroundConcept('Custom Question', playgroundPrompt)}
                >
                  {playgroundLoading ? (
                    <>
                      <Loader2 className="animate-spin h-3.5 w-3.5" />
                      Explaining...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      Explain Concept
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Generated Explanation Content Pane */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm min-h-[300px]">
              {playgroundLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-500">
                  <Loader2 className="animate-spin h-8 w-8 text-brand-600" />
                  <span className="text-xs font-bold">AI Teacher is modeling diagrams & flashcards...</span>
                </div>
              ) : playgroundContent ? (
                <div dangerouslySetInnerHTML={{ __html: parseMarkdown(playgroundContent) }} className="markdown-content font-main"></div>
              ) : (
                <div className="text-center py-20 text-slate-400 text-xs">
                  Click any topic button above or type a custom question to generate interactive explanations!
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= VIEW 5: MEGAPROJECTS ================= */}
        {activeTab === 'projects' && (
          <div className="space-y-6">
            {db.projects.map(proj => (
              <div key={`${proj.name}-${proj.week}`} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold text-brand-600 uppercase tracking-widest bg-brand-50 px-2.5 py-0.5 rounded-full">
                      Month {Math.ceil(proj.week / 4)} | Week {proj.week}
                    </span>
                    <h3 className="text-lg font-black text-slate-800 mt-2">{proj.name}</h3>
                  </div>

                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500"
                      checked={proj.completed || false}
                      onChange={e => toggleProject(proj.name, proj.week, e.target.checked)}
                    />
                    <span>Mark Completed</span>
                  </label>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">{proj.description}</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">GitHub Repository URL</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-sm"
                      placeholder="https://github.com/username/project"
                      value={proj.github_url || ''}
                      onChange={e => updateProjectFields(proj.name, proj.week, { github_url: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Duration (Hours Spent)</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-sm"
                      min="0"
                      value={proj.time_spent_hours || 0}
                      onChange={e => updateProjectFields(proj.name, proj.week, { time_spent_hours: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Development Notes & Architecture doubts</label>
                  <textarea
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-sm min-h-[60px]"
                    value={proj.notes || ''}
                    placeholder="Write project highlights, pipelines, Spark configurations or problems encountered..."
                    onChange={e => updateProjectFields(proj.name, proj.week, { notes: e.target.value })}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ================= VIEW 6: CHEAT SHEETS ================= */}
        {activeTab === 'cheatsheets' && (
          <div className="space-y-6">
            {Object.keys(db.cheat_sheets).map(key => {
              const sheet = db.cheat_sheets[key];
              return (
                <div key={key} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-base font-extrabold text-brand-700 mb-3">
                    📝 {sheet.title} Syntax Checklist
                  </h3>
                  <textarea
                    className="w-full p-4 border border-slate-200 rounded-xl font-code text-xs leading-relaxed focus:outline-none focus:border-brand-500 min-h-[220px]"
                    value={sheet.content || ''}
                    onChange={e => {
                      const updatedSheets = { ...db.cheat_sheets };
                      updatedSheets[key].content = e.target.value;
                      setDb(prev => ({ ...prev, cheat_sheets: updatedSheets }));
                      syncCheatSheet(key, updatedSheets[key]);
                    }}
                    placeholder={`Write your custom ${sheet.title} cheat sheets, syntax, commands, PySpark setups...`}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* ================= VIEW 7: ADMIN COCKPIT ================= */}
        {activeTab === 'admin' && (
          <div>
            {!adminAuthenticated ? (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm max-w-sm mx-auto text-center mt-12 space-y-4">
                <h3 className="text-lg font-black text-slate-800 flex items-center justify-center gap-2">
                  <Lock className="text-brand-600 h-5 w-5" />
                  Admin Gateway
                </h3>
                <form onSubmit={handleAdminVerify} className="space-y-3">
                  <input
                    type="password"
                    placeholder="Enter Admin PIN (6565)"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-sm text-center"
                    value={adminPinInput}
                    onChange={e => setAdminPinInput(e.target.value)}
                  />
                  <button type="submit" className="w-full py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg text-sm transition-colors">
                    Verify Access
                  </button>
                </form>
              </div>
            ) : (
              <div className="flex gap-6">
                
                {/* Sidebar directories */}
                <div className="w-72 bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-3 flex-shrink-0 h-[80vh] overflow-y-auto">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search users..."
                      className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-sm"
                      value={adminSearch}
                      onChange={e => setAdminSearch(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1 overflow-y-auto flex-1">
                    {adminUsers
                      .filter(u => u.name.toLowerCase().includes(adminSearch.toLowerCase()) || u.email.toLowerCase().includes(adminSearch.toLowerCase()))
                      .map(u => (
                        <div
                          key={u.id}
                          className={`p-3 rounded-lg text-xs font-semibold cursor-pointer transition-all flex justify-between items-center ${
                            adminSelectedUser?.id === u.id ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'
                          }`}
                          onClick={() => selectUserAdminInspect(u)}
                        >
                          <div>
                            <div className="font-bold">{u.name}</div>
                            <div className="text-[10px] text-emerald-600 font-bold mt-0.5">₹{u.total_money_earned || 0} earned</div>
                          </div>
                          <button
                            className="py-1 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-md text-[10px] font-bold"
                            onClick={e => {
                              e.stopPropagation();
                              deleteUserAccount(u.id, u.name);
                            }}
                          >
                            Wipe
                          </button>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Main Inspector Pane */}
                <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-6 h-[80vh] overflow-y-auto">
                  {adminSelectedUser ? (
                    <div className="space-y-6">
                      <h3 className="text-lg font-black text-slate-800 border-b border-slate-100 pb-3 flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <User className="text-brand-600 h-5 w-5" />
                          Student details: {adminSelectedUser.name}
                        </span>
                        <span className="text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full">
                          Total Earned: ₹{adminSelectedUser.total_money_earned || 0}
                        </span>
                      </h3>
                      
                      <div className="flex gap-2 border-b border-slate-100 pb-3">
                        {['overview', 'calendar', 'code'].map(t => (
                          <button
                            key={t}
                            className={`py-1.5 px-3 rounded-lg text-xs font-bold capitalize transition-colors ${
                              adminInspectTab === t ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                            }`}
                            onClick={() => setAdminInspectTab(t)}
                          >
                            {t}
                          </button>
                        ))}
                      </div>

                      {/* Admin Tab 1: Overview */}
                      {adminInspectTab === 'overview' && (
                        <div className="grid grid-cols-2 gap-6">
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Level & XP</span>
                            <span className="text-2xl font-black text-slate-800 mt-1 block">Level {adminSelectedUser.level}</span>
                            <span className="text-xs text-slate-500 mt-1 block">{adminSelectedUser.xp} accumulated XP</span>
                          </div>
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Weekly Earnings</span>
                            <span className="text-2xl font-black text-emerald-600 mt-1 block">₹{adminSelectedUser.weekly_money_earned || 0} / ₹1000</span>
                            <span className="text-xs text-slate-500 mt-1 block">Max ₹1000/week</span>
                          </div>
                        </div>
                      )}

                      {/* Admin Tab 2: Calendar */}
                      {adminInspectTab === 'calendar' && adminSelectedUserProgress && (
                        <div className="space-y-6">
                          <div className="grid grid-cols-10 gap-2">
                            {adminSelectedUserProgress.calendar.map(day => (
                              <div
                                key={day.day_number}
                                onClick={() => setAdminInspectDay(day)}
                                className={`py-2 px-1 text-[10px] font-bold text-center rounded-lg cursor-pointer transition-all border ${
                                  adminInspectDay?.day_number === day.day_number ? 'border-brand-500 ring-2 ring-brand-100' : 'border-transparent'
                                } ${
                                  day.completed ? 'bg-teal-100 text-teal-800' : (day.penalized ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600')
                                }`}
                              >
                                D{day.day_number}
                              </div>
                            ))}
                          </div>

                          {adminInspectDay && (
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                              <h4 className="text-sm font-bold text-slate-800">Day {adminInspectDay.day_number} Logs</h4>
                              <p className="text-xs text-slate-600"><strong>Curriculum Topic:</strong> {adminInspectDay.topic}</p>
                              <p className="text-xs text-slate-600"><strong>Study Time logged:</strong> {adminInspectDay.time_spent_minutes} mins</p>
                              <p className="text-xs text-slate-600"><strong>Reward Earned:</strong> ₹{adminInspectDay.daily_reward_earned || 0} {adminInspectDay.reward_claimed ? '(Claimed)' : '(Unclaimed)'}</p>
                              <p className="text-xs text-slate-600"><strong>Reflections:</strong> {adminInspectDay.notes || 'None written.'}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Admin Tab 3: Code solutions & AI Scores */}
                      {adminInspectTab === 'code' && adminSelectedUserProgress && (
                        <div className="flex gap-6">
                          <div className="w-56 space-y-3 flex-shrink-0">
                            <select
                              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-xs bg-white"
                              value={adminInspectCategory}
                              onChange={e => setAdminInspectCategory(e.target.value)}
                            >
                              <option value="sql">SQL Coding</option>
                              <option value="dsa">DSA Algorithmic</option>
                              <option value="pyspark">PySpark</option>
                            </select>

                            <div className="space-y-1 overflow-y-auto max-h-[300px] border border-slate-100 rounded-xl p-2 bg-slate-50">
                              {adminSelectedUserProgress[`${adminInspectCategory === 'sql' ? 'sql_question_bank' : (adminInspectCategory === 'dsa' ? 'dsa_problems' : 'pyspark_questions')}`]
                                .filter(q => q.solved)
                                .map(q => (
                                  <div
                                    key={q.id}
                                    onClick={() => setAdminInspectQId(q.id)}
                                    className={`px-3 py-2 rounded-lg text-[10px] font-bold cursor-pointer transition-all flex justify-between items-center ${
                                      adminInspectQId === q.id ? 'bg-brand-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'
                                    }`}
                                  >
                                    <span className="truncate flex-1">#{q.id} {q.question || q.title}</span>
                                    {q.ai_score !== null && (
                                      <span className="ml-1 px-1.5 py-0.5 rounded bg-white/20 text-white text-[9px] font-mono">
                                        {q.ai_score}/10
                                      </span>
                                    )}
                                  </div>
                                ))}
                            </div>
                          </div>

                          <div className="flex-1">
                            {(() => {
                              const list = adminSelectedUserProgress[`${adminInspectCategory === 'sql' ? 'sql_question_bank' : (adminInspectCategory === 'dsa' ? 'dsa_problems' : 'pyspark_questions')}`];
                              const q = list.find(item => item.id === adminInspectQId);
                              if (!q) return <span className="text-slate-400 text-xs">Select a solved question to inspect code solution & AI Score.</span>;

                              return (
                                <div className="space-y-3">
                                  <div className="flex justify-between items-center">
                                    <h4 className="text-sm font-bold text-slate-800">#{q.id} {q.question || q.title}</h4>
                                    {q.ai_score !== null && (
                                      <span className={`text-xs font-extrabold px-3 py-1 rounded-full ${
                                        q.ai_score >= 8 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                                      }`}>
                                        AI Score: {q.ai_score}/10
                                      </span>
                                    )}
                                  </div>
                                  <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl font-code text-xs overflow-x-auto max-h-[250px]">
                                    <code>{q.solution_code || 'No solution code submitted.'}</code>
                                  </pre>
                                  <div className="text-xs text-slate-600">
                                    <strong>Personal Notes:</strong> {q.notes || 'None written.'}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      )}

                    </div>
                  ) : (
                    <div className="text-center py-20 text-slate-400 text-sm">
                      Select a student directory account to inspect complete dashboard metrics.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= VIEW 8: SETTINGS ================= */}
        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-3">
                👤 Edit Student Profile
              </h3>
              
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Full Name</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-sm"
                  value={db.user_profile?.name}
                  onChange={e => {
                    const profile = { ...db.user_profile, name: e.target.value };
                    setDb(prev => ({ ...prev, user_profile: profile }));
                    syncProfile(profile);
                  }}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Email Address</label>
                <input
                  type="email"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-100 text-slate-500 cursor-not-allowed"
                  value={db.user_profile?.email}
                  disabled
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Career Target Goal</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-sm"
                  value={db.user_profile?.goal}
                  onChange={e => {
                    const profile = { ...db.user_profile, goal: e.target.value };
                    setDb(prev => ({ ...prev, user_profile: profile }));
                    syncProfile(profile);
                  }}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Target Companies (Comma separated)</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-sm"
                  value={db.user_profile?.target_companies?.join(', ')}
                  onChange={e => {
                    const profile = { ...db.user_profile, target_companies: e.target.value.split(',').map(s => s.trim()).filter(Boolean) };
                    setDb(prev => ({ ...prev, user_profile: profile }));
                    syncProfile(profile);
                  }}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Daily Study Target (Hours)</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-sm"
                  min="1"
                  max="24"
                  value={db.user_profile?.daily_study_hours}
                  onChange={e => {
                    const profile = { ...db.user_profile, daily_study_hours: parseInt(e.target.value) || 5 };
                    setDb(prev => ({ ...prev, user_profile: profile }));
                    syncProfile(profile);
                  }}
                />
              </div>

              <div className="border-t border-slate-100 pt-4 mt-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1 text-brand-600">🤖 Gemini API Key</label>
                <input
                  type="password"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-sm"
                  placeholder="Paste your Gemini key here"
                  value={db.user_profile?.gemini_api_key}
                  onChange={e => {
                    const profile = { ...db.user_profile, gemini_api_key: e.target.value };
                    setDb(prev => ({ ...prev, user_profile: profile }));
                    syncProfile(profile);
                  }}
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Needed for AI Coach reviewing, grading code, and custom doubts.</span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1 text-teal-700">🔗 Deployed Backend API URL</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-sm"
                  placeholder="e.g. https://your-backend.onrender.com"
                  value={localStorage.getItem('de_tracker_backend_url') || ''}
                  onChange={e => {
                    const val = e.target.value.trim();
                    if (val) localStorage.setItem('de_tracker_backend_url', val);
                    else localStorage.removeItem('de_tracker_backend_url');
                    showNotification("Backend URL updated. Reloading page...");
                    setTimeout(() => window.location.reload(), 1200);
                  }}
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Leave blank for local environment. Reloads application on change.</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 h-fit">
              <h3 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-3">
                ⚙️ Reset Tracker State
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                If you wish to wipe all check-ins, custom notes, syntax sheets, streaks, levels, and solutions to start completely fresh from Day 1, execute this reset trigger.
              </p>
              <button
                className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg text-xs transition-colors"
                onClick={handleResetDatabase}
              >
                Wipe & Reset Database Progress
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ================= MODAL 1: CALENDAR DAY DETAIL DRAWER ================= */}
      {selectedDay && (
        <div
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedDay(null)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="text-lg font-black text-slate-800">📅 Day {selectedDay.day_number} Detail Config</h3>
              <button
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                onClick={() => setSelectedDay(null)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="text-sm">
                <strong>Curriculum Topic:</strong> <span className="text-brand-600 font-bold">{selectedDay.topic}</span>
              </div>

              {/* Task list quick display */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2 text-xs text-slate-600 leading-relaxed">
                <div>🌅 <strong>Morning:</strong> {selectedDay.morning_task}</div>
                <div>☀️ <strong>Afternoon:</strong> {selectedDay.afternoon_task}</div>
                <div>🌙 <strong>Evening:</strong> {selectedDay.evening_task}</div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Study Duration Gained (Minutes)</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-sm"
                  min="0"
                  value={selectedDay.time_spent_minutes}
                  onChange={e => setSelectedDay({ ...selectedDay, time_spent_minutes: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Confidence Rating (1-5)</label>
                <select
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-sm bg-white"
                  value={selectedDay.rating || ''}
                  onChange={e => setSelectedDay({ ...selectedDay, rating: parseInt(e.target.value) || null })}
                >
                  <option value="">Select confidence</option>
                  <option value="1">1 - Struggled</option>
                  <option value="2">2 - Tough</option>
                  <option value="3">3 - Ok</option>
                  <option value="4">4 - Confident</option>
                  <option value="5">5 - Mastered</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Daily reflections, notes or logical doubts</label>
                <textarea
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-sm min-h-[100px]"
                  value={selectedDay.notes}
                  placeholder="What did you learn today? Edge cases? Notes on Spark jobs?"
                  onChange={e => setSelectedDay({ ...selectedDay, notes: e.target.value })}
                />
              </div>

              <div className="flex gap-2.5 justify-end border-t border-slate-100 pt-4">
                <button
                  className="py-2 px-4 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-bold text-slate-600 transition-colors"
                  onClick={() => setSelectedDay(null)}
                >
                  Cancel
                </button>
                <button
                  className="py-2 px-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg text-xs transition-colors"
                  onClick={saveDayDetails}
                >
                  Save Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: QUESTION WORKSPACE MODAL ================= */}
      {selectedQuestion && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedQuestion(null)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex justify-between items-start border-b border-slate-200 p-6 bg-slate-50">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-extrabold uppercase tracking-wider px-3 py-0.5 rounded-full ${
                    (selectedQuestion.difficulty || '').toLowerCase() === 'easy' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                    ((selectedQuestion.difficulty || '').toLowerCase() === 'medium' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-rose-50 text-rose-700 border border-rose-100')
                  }`}>
                    {selectedQuestion.difficulty || 'Concept'}
                  </span>
                  {selectedQuestion.ai_score !== null && selectedQuestion.ai_score !== undefined && (
                    <span className={`text-[10px] font-extrabold uppercase tracking-wider px-3 py-0.5 rounded-full ${
                      selectedQuestion.ai_score >= 8 ? 'bg-emerald-600 text-white shadow-sm' : 'bg-amber-500 text-white'
                    }`}>
                      AI Score: {selectedQuestion.ai_score}/10
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-black text-slate-900 mt-2">
                  #{selectedQuestion.id} {selectedQuestion.question || selectedQuestion.title}
                </h3>
              </div>
              <button
                className="p-1 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                onClick={() => setSelectedQuestion(null)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Split Pane Details layout */}
            <div className="flex flex-1 overflow-hidden">
              
              {/* Left pane: Question description AND Interactive Schema Viewer */}
              <div className="w-1/2 p-6 overflow-y-auto border-r border-slate-200 space-y-5 bg-slate-50/50">
                <div className="space-y-2">
                  <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Question Details</h4>
                  <div className="text-sm text-slate-700 leading-relaxed font-main">
                    {selectedQuestion.description || selectedQuestion.question || "Core Data Engineering learning item. Write down your solution notes."}
                  </div>
                </div>

                {selectedQuestion.de_relevance && (
                  <div className="p-4 bg-teal-50/60 rounded-xl border border-teal-100 border-l-4 border-l-brand-600 space-y-1">
                    <span className="text-[10px] font-bold text-brand-700 uppercase tracking-widest">DE Relevance</span>
                    <p className="text-xs text-slate-600 leading-relaxed">{selectedQuestion.de_relevance}</p>
                  </div>
                )}

                {/* Schema & Mock Data Visualizer */}
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center">
                    <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Database className="h-3.5 w-3.5 text-brand-600" />
                      Database Schema & Mock Data Tables
                    </h4>
                    <button
                      disabled={schemaLoading}
                      className="py-1 px-2.5 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1"
                      onClick={generateSchemaMockTables}
                    >
                      {schemaLoading ? (
                        <>
                          <Loader2 className="animate-spin h-3 w-3" />
                          Generating Tables...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3 w-3" />
                          {selectedQuestion.ai_schema_context ? 'Regenerate Tables' : 'Generate Tables'}
                        </>
                      )}
                    </button>
                  </div>

                  {selectedQuestion.ai_schema_context ? (
                    <div
                      className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm text-xs leading-relaxed max-h-[300px] overflow-y-auto markdown-content"
                      dangerouslySetInnerHTML={{ __html: parseMarkdown(selectedQuestion.ai_schema_context) }}
                    ></div>
                  ) : (
                    <div className="p-6 bg-white rounded-xl border border-slate-200 text-center space-y-2">
                      <Database className="h-6 w-6 text-slate-300 mx-auto" />
                      <p className="text-xs text-slate-500">No mock tables generated for this question yet.</p>
                      <button
                        disabled={schemaLoading}
                        className="py-1.5 px-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 mx-auto"
                        onClick={generateSchemaMockTables}
                      >
                        {schemaLoading ? (
                          <>
                            <Loader2 className="animate-spin h-3.5 w-3.5" />
                            Generating Tables...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3.5 w-3.5" />
                            Generate Schema & Sample Tables
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Right pane: Tabs and editors */}
              <div className="w-1/2 flex flex-col justify-between p-6 overflow-y-auto">
                <div className="flex gap-1.5 border-b border-slate-200 pb-3 mb-4">
                  {['code', 'notes', 'coach'].map(t => (
                    <button
                      key={t}
                      className={`py-1.5 px-3.5 rounded-lg text-xs font-bold capitalize transition-colors ${
                        workspaceTab === t ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                      onClick={() => setWorkspaceTab(t)}
                    >
                      {t === 'code' ? '💻 Editor' : (t === 'notes' ? '📝 Notes' : '🤖 AI Auto-Scorer')}
                    </button>
                  ))}
                </div>

                {/* Subtab 1: Code editor */}
                {workspaceTab === 'code' && (
                  <div className="flex-1 flex flex-col justify-between gap-4">
                    <textarea
                      className="w-full flex-1 p-4 bg-slate-900 text-slate-100 rounded-xl font-code text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-500/20 max-h-[360px] min-h-[260px]"
                      value={workspaceCode}
                      onChange={e => setWorkspaceCode(e.target.value)}
                      placeholder={selectedQuestionCategory === 'sql' ? "-- Write your SQL query solution here..." : "# Write your Python/PySpark solution here..."}
                    />

                    <div className="flex justify-between items-center border-t border-slate-100 pt-3">
                      <button
                        disabled={evalLoading}
                        className="py-2 px-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center gap-2 shadow-sm"
                        onClick={evaluateAndRateSolution}
                      >
                        {evalLoading ? (
                          <>
                            <Loader2 className="animate-spin h-3.5 w-3.5" />
                            Evaluating & Scoring...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3.5 w-3.5" />
                            Evaluate & Auto-Score Code (0-10)
                          </>
                        )}
                      </button>

                      <button
                        className="py-2 px-4 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5"
                        onClick={() => handleSolveQuestion(true)}
                      >
                        <Save className="h-3.5 w-3.5" />
                        Save Solution
                      </button>
                    </div>
                  </div>
                )}

                {/* Subtab 2: Notes */}
                {workspaceTab === 'notes' && (
                  <div className="flex-1 flex flex-col justify-between gap-4">
                    <textarea
                      className="w-full flex-1 p-4 border border-slate-200 rounded-xl font-main text-xs leading-relaxed focus:outline-none focus:border-brand-500 max-h-[360px] min-h-[260px]"
                      value={workspaceNotes}
                      onChange={e => setWorkspaceNotes(e.target.value)}
                      placeholder="Write your study notes, doubts, edge cases or alternative approaches..."
                    />
                    <button
                      className="py-2 px-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg text-xs transition-colors self-end"
                      onClick={() => handleSolveQuestion(selectedQuestion.solved)}
                    >
                      Save Notes
                    </button>
                  </div>
                )}

                {/* Subtab 3: AI Auto-Scorer & Hints */}
                {workspaceTab === 'coach' && (
                  <div className="flex-1 flex flex-col justify-between gap-4">
                    <div className="flex gap-2 border-b border-slate-100 pb-2">
                      {['hint', 'chat'].map(t => (
                        <button
                          key={t}
                          className={`py-1 px-2.5 rounded-lg text-[10px] font-bold capitalize transition-colors ${
                            aiSubTab === t ? 'bg-slate-200 text-slate-800' : 'text-slate-500 hover:bg-slate-50'
                          }`}
                          onClick={() => setAiSubTab(t)}
                        >
                          {t === 'hint' ? '🏆 AI Review & Score' : '💬 Chat Doubts'}
                        </button>
                      ))}
                    </div>

                    <div className="flex-1 border border-slate-200 rounded-xl p-4 bg-slate-50 overflow-y-auto text-xs leading-relaxed max-h-[280px] min-h-[230px]">
                      {evalLoading && (
                        <div className="flex flex-col justify-center items-center gap-2 pt-12 text-slate-500">
                          <Loader2 className="animate-spin h-6 w-6 text-brand-600" />
                          <span>AI Coach is grading your solution against schema constraints...</span>
                        </div>
                      )}

                      {!evalLoading && (
                        <>
                          {/* Grade code */}
                          {aiSubTab === 'hint' && (
                            selectedQuestion.ai_code_review_hint ? (
                              <div className="space-y-3">
                                {selectedQuestion.ai_score !== null && (
                                  <div className={`p-3 rounded-xl border flex items-center justify-between shadow-sm ${
                                    selectedQuestion.ai_score >= 8 ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'
                                  }`}>
                                    <div className="flex items-center gap-2">
                                      <Award className={`h-5 w-5 ${selectedQuestion.ai_score >= 8 ? 'text-emerald-600' : 'text-amber-600'}`} />
                                      <span className="font-extrabold text-sm">
                                        AI Score Result: {selectedQuestion.ai_score}/10
                                      </span>
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/60">
                                      {selectedQuestion.ai_score >= 8 ? 'High Distinction 🏆' : 'Needs Work 💡'}
                                    </span>
                                  </div>
                                )}
                                <div dangerouslySetInnerHTML={{ __html: parseMarkdown(selectedQuestion.ai_code_review_hint) }} className="markdown-content"></div>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-3 pt-12 text-slate-500 text-center">
                                <TrendingUp className="h-8 w-8 text-slate-300" />
                                <span>Coach has not graded your query yet.</span>
                                <button
                                  disabled={evalLoading}
                                  className="py-2 px-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5"
                                  onClick={evaluateAndRateSolution}
                                >
                                  {evalLoading ? (
                                    <>
                                      <Loader2 className="animate-spin h-3.5 w-3.5" />
                                      Evaluating...
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles className="h-3.5 w-3.5" />
                                      Grade & Auto-Score Code (0-10)
                                    </>
                                  )}
                                </button>
                              </div>
                            )
                          )}

                          {/* Chat */}
                          {aiSubTab === 'chat' && (
                            <div className="space-y-3">
                              {(selectedQuestion.ai_chat_history || []).length === 0 ? (
                                <div className="p-3 bg-brand-50/50 border border-brand-100 rounded-lg text-brand-700 flex gap-2">
                                  <MessageSquare className="h-4 w-4 mt-0.5 text-brand-600 flex-shrink-0" />
                                  <span>👋 Ask me doubts about your queries, logic, or syntax. I'll guide you to the answer.</span>
                                </div>
                              ) : (
                                (selectedQuestion.ai_chat_history || []).map((msg, idx) => (
                                  <div
                                    key={idx}
                                    className={`p-2.5 rounded-xl text-xs ${
                                      msg.role === 'coach' ? 'bg-brand-50/50 border border-brand-100 text-slate-800' : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    <strong>{msg.role === 'coach' ? '🤖 Coach' : '👤 You'}:</strong>
                                    <div dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.text) }} className="markdown-content mt-1"></div>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Doubts chat entry input */}
                    {aiSubTab === 'chat' && (
                      <form onSubmit={sendAICustomDoubt} className="flex gap-2 mt-2">
                        <input
                          type="text"
                          placeholder="Type doubts (e.g. why do we need CTE here?)..."
                          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-xs bg-white"
                          value={aiChatQuery}
                          onChange={e => setAiChatQuery(e.target.value)}
                        />
                        <button
                          type="submit"
                          disabled={chatLoading}
                          className="py-2 px-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center gap-1"
                        >
                          {chatLoading ? <Loader2 className="animate-spin h-3 w-3" /> : 'Ask'}
                        </button>
                      </form>
                    )}

                  </div>
                )}

              </div>
            </div>

          </div>
        </div>
      )}

      {/* ================= MODAL 3: TODAY'S AI TOPIC QUIZ ================= */}
      {quizModalOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-main"
          onClick={() => setQuizModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl p-6 space-y-6 max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <BrainCircuit className="text-brand-600 h-5 w-5" />
                Today's Topic AI Quiz
              </h3>
              <button
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                onClick={() => setQuizModalOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {quizLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500">
                <Loader2 className="animate-spin h-8 w-8 text-brand-600" />
                <span className="text-xs font-bold">Generating 3 quiz questions...</span>
              </div>
            ) : (
              <div className="space-y-6">
                {quizQuestions.map((q, qIdx) => (
                  <div key={qIdx} className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <h4 className="text-xs font-bold text-slate-800">
                      Q{qIdx + 1}: {q.question}
                    </h4>
                    <div className="space-y-2">
                      {q.options.map((opt, oIdx) => {
                        const isSelected = quizAnswers[qIdx] === oIdx;
                        const isCorrect = q.answerIndex === oIdx;

                        let style = "bg-white border-slate-200 text-slate-700 hover:bg-slate-100";
                        if (quizSubmitted) {
                          if (isCorrect) style = "bg-emerald-50 border-emerald-300 text-emerald-800 font-bold";
                          else if (isSelected) style = "bg-rose-50 border-rose-300 text-rose-800 font-bold";
                        } else if (isSelected) {
                          style = "bg-brand-50 border-brand-500 text-brand-800 font-bold";
                        }

                        return (
                          <div
                            key={oIdx}
                            className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${style}`}
                            onClick={() => {
                              if (!quizSubmitted) {
                                setQuizAnswers({ ...quizAnswers, [qIdx]: oIdx });
                              }
                            }}
                          >
                            {opt}
                          </div>
                        );
                      })}
                    </div>

                    {quizSubmitted && (
                      <p className="text-[11px] text-slate-600 italic bg-white p-2.5 rounded-lg border border-slate-200">
                        💡 <strong>Explanation:</strong> {q.explanation}
                      </p>
                    )}
                  </div>
                ))}

                <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                  {!quizSubmitted ? (
                    <button
                      className="py-2.5 px-5 bg-brand-600 hover:bg-brand-700 text-white font-extrabold rounded-xl text-xs transition-colors shadow-sm"
                      onClick={submitQuiz}
                    >
                      Submit Answers
                    </button>
                  ) : (
                    <button
                      className="py-2.5 px-5 bg-slate-800 hover:bg-slate-900 text-white font-extrabold rounded-xl text-xs transition-colors"
                      onClick={() => setQuizModalOpen(false)}
                    >
                      Done
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
