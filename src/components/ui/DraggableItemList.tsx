import { ReactNode } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface DraggableItemListProps<T> {
  items: T[];
  onReorder: (newOrder: T[]) => void;
  renderItem: (
    item: T,
    index: number,
    isDragging: boolean,
    dragHandleProps: { attributes: any; listeners: any }
  ) => ReactNode;
  keyExtractor: (item: T) => string;
  className?: string;
  itemClassName?: string;
}

interface SortableItemProps<T> {
  item: T;
  index: number;
  renderItem: (
    item: T,
    index: number,
    isDragging: boolean,
    dragHandleProps: { attributes: any; listeners: any }
  ) => ReactNode;
  className?: string;
}

function SortableItem<T>({
  item,
  index,
  renderItem,
  className = '',
}: SortableItemProps<T>) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: index.toString() });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${className} ${isDragging ? 'z-50 shadow-lg bg-white' : ''}`}
    >
      {renderItem(item, index, isDragging, { attributes, listeners })}
    </div>
  );
}

export function DraggableItemList<T>({
  items,
  onReorder,
  renderItem,
  keyExtractor,
  className = '',
  itemClassName = '',
}: DraggableItemListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (active.id !== over?.id && over) {
      const oldIndex = parseInt(active.id as string);
      const newIndex = parseInt(over.id as string);

      const newItems = arrayMove(items, oldIndex, newIndex);
      onReorder(newItems);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((_, index) => index.toString())}
        strategy={verticalListSortingStrategy}
      >
        <div className={className}>
          {items.map((item, index) => (
            <SortableItem
              key={keyExtractor(item)}
              item={item}
              index={index}
              renderItem={renderItem}
              className={itemClassName}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
