// Actors module: delivery robot, carried item, route guidance line, status label and highlights.
import { useFoStore } from '../../store';
import Robot from './Robot';
import Item from './Items';
import RoutePath from './RoutePath';
import Highlights from './Highlights';

export default function Actors() {
  const route = useFoStore((s) => s.route);
  const accent = useFoStore((s) => s.scene.accent);
  return (
    <>
      <Robot />
      <Item />
      <RoutePath points={route} color={accent ?? '#7c9cff'} />
      <Highlights />
    </>
  );
}
