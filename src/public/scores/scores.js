document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    const scoresTableBody = document.getElementById('scores-table-body');
    
    function updateScores(scores) {
        scoresTableBody.innerHTML = '';
        
        scores.forEach((score, index) => {
            const row = document.createElement('tr');
            
            const position = document.createElement('td');
            position.textContent = index + 1;
            row.appendChild(position);
            
            const points = document.createElement('td');
            points.textContent = score.points;
            row.appendChild(points);
            
            const lines = document.createElement('td');
            lines.textContent = score.lines;
            row.appendChild(lines);
            
            const date = document.createElement('td');
            date.textContent = new Date(score.timestamp).toLocaleString('lt-LT');
            row.appendChild(date);
            
            scoresTableBody.appendChild(row);
        });
    }
    
    // Initial scores load
    fetch('/api/scores')
        .then(response => response.json())
        .then(scores => {
            updateScores(scores);
        })
        .catch(error => {
            console.error('Error loading scores:', error);
            scoresTableBody.innerHTML = '<tr><td colspan="4" class="error">Klaida kraunant rezultatus</td></tr>';
        });
    
    // Listen for score updates
    socket.on('updateHighScores', () => {
        fetch('/api/scores')
            .then(response => response.json())
            .then(scores => {
                updateScores(scores);
            })
            .catch(error => {
                console.error('Error updating scores:', error);
            });
    });
});
