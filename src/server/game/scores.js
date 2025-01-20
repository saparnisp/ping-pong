import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MAX_SCORES = 100;
const SCORES_FILE = path.join(__dirname, '..', '..', '..', 'scores.json');

let scores = [];

// Load scores from file
async function loadScores() {
    try {
        const data = await fs.readFile(SCORES_FILE, 'utf8');
        scores = JSON.parse(data).slice(0, MAX_SCORES);
        return scores;
    } catch (error) {
        console.error('Error loading scores:', error);
        scores = [];
        return scores;
    }
}

// Save scores to file
async function saveScores() {
    try {
        await fs.writeFile(SCORES_FILE, JSON.stringify(scores));
    } catch (error) {
        console.error('Error saving scores:', error);
    }
}

// Add new score
async function addScore(score) {
    const newScore = {
        points: score.points,
        lines: score.lines,
        timestamp: new Date().toISOString()
    };
    
    scores.unshift(newScore);
    scores = scores.slice(0, MAX_SCORES);
    await saveScores();
    return scores;
}

// Get all scores
function getScores() {
    return scores;
}

export {
    loadScores,
    saveScores,
    addScore,
    getScores,
    MAX_SCORES
};
