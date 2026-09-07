import '../../tokens/colors.css';
import './Notice.module.css';

export function Notice({ children }: { children: React.ReactNode }) {
  return <aside className="notice">{children}</aside>;
}
