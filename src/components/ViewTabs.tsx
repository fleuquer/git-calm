import { Plus, Settings } from 'lucide-react';
import type { ViewTab } from '../types';

interface ViewTabsProps {
  views: ViewTab[];
  activeViewId: string;
  onViewChange: (viewId: string) => void;
  onManageViews?: () => void;
}

const colorClasses = {
  blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700',
  purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700',
  green: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700',
  orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700',
  yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700',
  red: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700',
  gray: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600',
};

export function ViewTabs({ views, activeViewId, onViewChange, onManageViews }: ViewTabsProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto border-b border-gray-200 dark:border-gray-700">
      <div className="flex gap-1.5 flex-1 min-w-0">
        {views.map((view) => {
          const isActive = view.id === activeViewId;
          const colorClass = colorClasses[view.color as keyof typeof colorClasses] || colorClasses.gray;

          return (
            <button
              key={view.id}
              onClick={() => onViewChange(view.id)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-xs whitespace-nowrap
                transition-all duration-200
                ${isActive
                  ? colorClass
                  : 'bg-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }
              `}
            >
              {view.icon && <span className="text-base">{view.icon}</span>}
              <span>{view.name}</span>
            </button>
          );
        })}
      </div>

      {onManageViews && (
        <button
          onClick={onManageViews}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shrink-0"
          title="Gerenciar visualizações"
        >
          <Settings size={14} />
          <Plus size={14} />
        </button>
      )}
    </div>
  );
}