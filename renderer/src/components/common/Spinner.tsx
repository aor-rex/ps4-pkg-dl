export default function Spinner({ size = 24 }: { size?: number }) {
  return (
    <div
      className="animate-spin"
      style={{
        width: size,
        height: size,
        border: '3px solid #3a5068',
        borderTop: '3px solid #66c0f4',
        borderRadius: '50%',
      }}
    />
  );
}
