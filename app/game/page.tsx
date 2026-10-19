'use client';

import { GameProvider, useGame } from '@/components/game-provider';
import { CreateRoundScreen } from '@/components/screens/create-round';
import { ListenImitateScreen } from '@/components/screens/listen-imitate';
import { GuessScreen } from '@/components/screens/guess';
import { RevealScreen } from '@/components/screens/reveal';
import { ErrorScreen } from '@/components/screens/error';

export default function GamePage() {
  return (
    <GameProvider>
      <GameRouter />
    </GameProvider>
  );
}

function GameRouter() {
  const { machine } = useGame();

  switch (machine.state) {
    case 'idle':
      return <CreateRoundScreen />;
    case 'requesting-microphone':
    case 'recording-original':
      return <CreateRoundScreen />;
    case 'processing-original':
    case 'listening-to-reversed':
      return <ListenImitateScreen stage="reversed" />;
    case 'recording-imitation':
      return <ListenImitateScreen stage="recording" />;
    case 'processing-imitation':
    case 'listening-to-reconstructed':
      return <ListenImitateScreen stage="reconstructed" />;
    case 'guessing':
      return <GuessScreen />;
    case 'revealed':
      return <RevealScreen />;
    case 'error':
      return <ErrorScreen />;
    default:
      return <CreateRoundScreen />;
  }
}
