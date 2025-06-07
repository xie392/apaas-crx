import { EditIcon, TrashIcon } from "lucide-react"

import type { Package } from "~types"

import { Button } from "./ui/button"

interface PackageItemProps {
  pkg: Package
  onDelete: (id: string) => void
  onEdit: (id: string) => void
  isEditing?: boolean
}

export const PackageItem: React.FC<PackageItemProps> = ({
  pkg,
  onDelete,
  onEdit,
  isEditing = false
}) => {
  // 阻止事件冒泡的处理函数
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation() // 防止事件冒泡
    e.preventDefault()
    onEdit(pkg.id)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation() // 防止事件冒泡
    e.preventDefault()
    onDelete(pkg.id)
  }

  return (
    <div
      className={`tw-flex tw-items-center tw-justify-between tw-p-3 tw-mb-2 tw-rounded ${
        isEditing
          ? "tw-bg-yellow-50 tw-border-2 tw-border-yellow-500 dark:tw-bg-yellow-950/30"
          : "tw-bg-gray-100 dark:tw-bg-gray-800"
      }`}>
      <div>
        <div className="tw-font-medium">{pkg.name}</div>
        <div className="tw-text-xs tw-text-gray-500">
          输出名称: {pkg.config.outputName}
        </div>
        <div className="tw-text-xs tw-text-gray-500">
          上传时间: {new Date(pkg.uploadedAt).toLocaleString()}
        </div>
        {isEditing && (
          <div className="tw-text-xs tw-text-yellow-600 dark:tw-text-yellow-400 tw-mt-1">
            <strong>编辑中</strong> - 请上传新文件进行替换
          </div>
        )}
      </div>
      <div className="tw-flex tw-space-x-2">
        <Button
          variant={isEditing ? "default" : "outline"}
          size="sm"
          onClick={handleEdit}
          disabled={isEditing}
          className={
            isEditing
              ? "tw-bg-yellow-500 tw-text-white hover:tw-bg-yellow-600"
              : ""
          }>
          <EditIcon className="tw-h-4 tw-w-4 tw-mr-1" />
          {isEditing ? "编辑中" : "编辑"}
        </Button>
        <Button variant="destructive" size="sm" onClick={handleDelete}>
          <TrashIcon className="tw-h-4 tw-w-4 tw-mr-1" />
          删除
        </Button>
      </div>
    </div>
  )
}
