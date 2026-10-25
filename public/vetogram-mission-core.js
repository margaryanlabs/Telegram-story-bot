// Presentation status only. NEVER infer event delivery or Story publish success
// from a connection/permission badge. No user/account data is read or stored.
export function missionPresentation({accountReady=false,privacyPermission=false,
  storiesBusiness=false,hasStatus=false}={}){
  const connected=hasStatus&&accountReady;
  return {
    account:!hasStatus?'Проверяем':connected?'Подключение найдено':'Требуется вход',
    privacy:!hasStatus?'Проверяем':privacyPermission?'Разрешение включено':'Настроить отдельно',
    stories:!hasStatus?'Проверяем':connected
      ?storiesBusiness?'Бизнес-доступ найден':'Проверить публикацию':'После входа',
    accountState:!hasStatus?'checking':connected?'available':'setup',
    privacyState:!hasStatus?'checking':privacyPermission?'permission':'setup',
    storiesState:!hasStatus?'checking':connected&&storiesBusiness?'permission':'setup',
    heading:connected?'Твоя рабочая среда':'Сначала — твой Telegram',
    detail:connected
      ?'Подключение найдено. Проверь доступ к архиву и публикации отдельно.'
      :'Подключи собственный аккаунт. Архив и истории включаются только с твоего согласия.',
    action:connected?'Открыть чаты':'Подключить Telegram',
    actionKind:connected?'chats':'connect'
  };
}
