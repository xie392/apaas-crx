import LogoImage from "data-base64:../../assets/icon.png"

import { cn } from "~/lib/utils"

interface LogoProps {
  size?: "small" | "medium" | "large"
  title?: string
}

export function Logo({
  size = "medium",
  title = "APaaS 脚本替换工具"
}: LogoProps) {
  return (
    <div className="tw-flex tw-items-center">
      <img
        src={LogoImage}
        alt="logo"
        className={cn("tw-mr-2", {
          "tw-w-6": size === "small",
          "tw-w-8": size === "medium",
          "tw-w-10": size === "large"
        })}
      />
      <h2
        className={cn("tw-font-bold tw-text-gray-800", {
          "tw-text-sm": size === "small",
          "tw-text-base": size === "medium",
          "tw-text-lg": size === "large"
        })}>
        {title}
      </h2>
    </div>
  )
}
