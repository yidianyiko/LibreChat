import React from 'react';
import { Circle, MoreHorizontal } from 'lucide-react';

enum CallState {
  Thinking = 'thinking',
}

type CircleRenderProps = {
  rmsLevel: number;
  isCameraOn: boolean;
  state: string;
};

const CircleRender = ({ rmsLevel, isCameraOn, state }: CircleRenderProps) => {
  const getIconComponent = (callState: string) => {
    switch (callState) {
      case CallState.Thinking:
        return <MoreHorizontal className="h-64 w-64" />;
      default:
        return (
          <div className="smooth-transition" style={{ transform: `scale(${transformScale})` }}>
            <Circle className="h-64 w-64" data-state={callState} />
          </div>
        );
    }
  };

  const baseScale = isCameraOn ? 0.5 : 1;
  const scaleMultiplier =
    rmsLevel > 0.08
      ? 1.8
      : rmsLevel > 0.07
        ? 1.6
        : rmsLevel > 0.05
          ? 1.4
          : rmsLevel > 0.01
            ? 1.2
            : 1;

  const transformScale = baseScale * scaleMultiplier;

  return getIconComponent(state);
};

export default CircleRender;
