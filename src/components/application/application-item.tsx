import { EditIcon, TrashIcon } from "lucide-react"

import { Button } from "~components/ui/button"
import { Switch } from "~components/ui/switch"
import type { Application } from "~types"

interface ApplicationItemProps {
  app: Application
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
}

export const ApplicationItem: React.FC<ApplicationItemProps> = ({
  app,
  onEdit,
  onDelete,
  onToggle
}) => {
  return (
    <div className="tw-border tw-rounded-md tw-p-4 tw-mb-3">
      <div className="tw-flex tw-justify-between tw-items-center tw-mb-3">
        <h3 className="tw-text-lg tw-font-medium">{app.name}</h3>
        <div className="tw-flex tw-items-center">
          <Switch
            checked={app.enabled}
            onCheckedChange={onToggle}
            className="tw-mr-2"
          />
          <span className="tw-text-sm tw-text-gray-500 tw-mr-3">
            {app.enabled ? "已启用包替换" : "已禁用包替换"}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            className="tw-mr-1">
            <EditIcon className="tw-h-4 tw-w-4 tw-mr-1" />
            编辑
          </Button>
          <Button variant="destructive" size="sm" onClick={onDelete}>
            <TrashIcon className="tw-h-4 tw-w-4 tw-mr-1" />
            删除
          </Button>
        </div>
      </div>

      <div className="tw-text-sm">
        <div className="tw-mb-2">
          <span className="tw-font-medium">URL 规则：</span>
          <div className="tw-flex tw-flex-wrap tw-gap-1 tw-mt-1">
            {app.urlPatterns.map((pattern, i) => (
              <span
                key={i}
                className="tw-bg-gray-100 dark:tw-bg-gray-800 tw-px-2 tw-py-1 tw-rounded tw-text-xs">
                {pattern}
              </span>
            ))}
          </div>
        </div>
        <div className="tw-mb-2">
          <span className="tw-font-medium">包数量：</span> {app.packages.length}
        </div>
        {app.devConfigs && app.devConfigs.length > 0 && (
          <div className="tw-mb-2">
            <span className="tw-font-medium">开发配置：</span> {app.devConfigs.length}
          </div>
        )}
      </div>
    </div>
  )
}
