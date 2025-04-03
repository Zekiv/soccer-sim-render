function resolveAllBets() {
    logDebug("Resolving all bets...");
    const winningTeam = scoreA > scoreB ? 'A' : (scoreB > scoreA ? 'B' : null); // null for draw

    clients.forEach((clientData, ws) => {
        if (clientData.currentBet) {
            const bet = clientData.currentBet;
            const initialBalance = clientData.balance; // Log initial balance
            let payout = 0;
            let message = "";
            const betTeamId = bet.team; // 'A' or 'B'
            const betTeamName = betTeamId === 'A' ? (teamA?.name || 'Team A') : (teamB?.name || 'Team B');
            const oddsVal = betTeamId === 'A' ? oddsA : oddsB;
            const odds = parseFloat(oddsVal);

            logDebug(`Resolving bet for ${clientData.nickname || clientData.id}: Bet $${bet.amount} on Team ${betTeamId} (${betTeamName}) at odds ${oddsVal}. Initial Bal: $${initialBalance.toFixed(2)}`);

            if (isNaN(odds) || odds <= 0) {
                 // Refund if odds are invalid
                 payout = bet.amount;
                 clientData.balance += payout;
                 message = `Error: Invalid odds (${oddsVal}) for match. Bet on ${betTeamName} refunded ($${bet.amount.toFixed(2)}).`;
                 logDebug(` -> Refund (Invalid Odds). Payout: $${payout.toFixed(2)}. New Bal: $${clientData.balance.toFixed(2)}`);
            } else if (betTeamId === winningTeam) {
                 // Bet won
                 payout = bet.amount * odds;
                 clientData.balance += payout; // Add winnings
                 message = `Bet on ${betTeamName} WON! +$${payout.toFixed(2)}.`;
                 logDebug(` -> Won. Payout: $${payout.toFixed(2)}. New Bal: $${clientData.balance.toFixed(2)}`);
            } else if (winningTeam === null) {
                 // Draw - Refund bet
                 payout = bet.amount;
                 clientData.balance += payout; // Add back the original bet amount
                 message = `Match Drawn! Bet on ${betTeamName} refunded ($${bet.amount.toFixed(2)}).`;
                 logDebug(` -> Draw (Refund). Payout: $${payout.toFixed(2)}. New Bal: $${clientData.balance.toFixed(2)}`);
            } else {
                 // Bet lost - payout is 0, balance already reduced when bet was placed
                 payout = 0; // Payout is technically 0
                 message = `Bet on ${betTeamName} LOST (-$${bet.amount.toFixed(2)}).`;
                  logDebug(` -> Lost. Payout: $${payout.toFixed(2)}. New Bal: $${clientData.balance.toFixed(2)}`); // Balance remains same as after bet placed
            }

            // Send result to client
            sendToClient(ws, {
                type: 'betResult',
                payload: {
                    success: (payout > 0 && winningTeam !== null) || winningTeam === null, // Success if won or refunded (draw/error)
                    message: message,
                    newBalance: clientData.balance // Send the final, updated balance
                }
            });

            clientData.currentBet = null; // Clear the bet after resolving
        }
    });
    logDebug("Bet resolution complete.");
}