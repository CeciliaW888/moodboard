import { Guide } from '../hooks/useAlignmentGuides';

interface AlignmentGuidesProps {
  guides: Guide[];
}

export const AlignmentGuides = ({ guides }: AlignmentGuidesProps) => {
  if (guides.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ width: '100%', height: '100%', overflow: 'visible' }}
    >
      {guides.map((guide, i) => (
        guide.type === 'vertical' ? (
          <line
            key={`v-${i}`}
            x1={guide.position}
            y1={guide.start - 20}
            x2={guide.position}
            y2={guide.end + 20}
            stroke="#f43f5e"
            strokeWidth={1}
            strokeDasharray="4 3"
            opacity={0.8}
          />
        ) : (
          <line
            key={`h-${i}`}
            x1={guide.start - 20}
            y1={guide.position}
            x2={guide.end + 20}
            y2={guide.position}
            stroke="#f43f5e"
            strokeWidth={1}
            strokeDasharray="4 3"
            opacity={0.8}
          />
        )
      ))}
    </svg>
  );
};
