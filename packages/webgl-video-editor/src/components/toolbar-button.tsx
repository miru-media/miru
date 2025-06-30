import { IconButton } from 'shared/components/icon-button'

export const ToolbarButton: typeof IconButton = (props) => {
  return <IconButton {...{ ...props, class: [props.class, 'toolbar-button'] }} />
}
